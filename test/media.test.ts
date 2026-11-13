// 媒体在线预览的 HTTP Range 语义。
// <video>/<audio> 靠 206 + Content-Range 做边下边播和拖动进度条；
// 这里钉住响应头、字节片段和大文件裁剪，避免「能播但拖不动」或
// 「一个 500MB 视频一次穿过 Worker」这类问题。
import { test } from 'vitest';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { mediaResponse, MAX_MEDIA_CHUNK } from '../src/media';

const ROOT = join(__dirname, '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

function streamOf(buf: Uint8Array): ReadableStream {
  return new ReadableStream({
    start(c) {
      c.enqueue(buf);
      c.close();
    },
  });
}

function makeStorage(buf: Uint8Array, ct = 'video/mp4', publicUrl: string | null = null) {
  return {
    publicUrl: () => publicUrl,
    presignGet: null,
    async head() {
      return { size: buf.length };
    },
    async get(_key: string, range?: { offset: number; length: number }) {
      const part = range ? buf.slice(range.offset, range.offset + range.length) : buf;
      return { body: streamOf(part), size: buf.length, contentType: ct, etag: '"abc"' };
    },
  };
}

const bytes = (n: number) => Uint8Array.from({ length: n }, (_, i) => i % 256);
const req = (range?: string) =>
  new Request('https://pan.example.com/preview/x', {
    headers: range ? { range } : {},
  });

test('无 Range 时返回 200，并声明 Accept-Ranges', async () => {
  const buf = bytes(1000);
  const r = await mediaResponse(req(), makeStorage(buf), 'k', { size: 1000, mime: 'video/mp4' });
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('accept-ranges'), 'bytes');
  assert.equal(r.headers.get('content-length'), '1000');
  assert.equal(r.headers.get('content-type'), 'video/mp4');
  assert.equal((await r.arrayBuffer()).byteLength, 1000);
});

test('带 Range 返回 206 + 正确的 Content-Range 和字节片段', async () => {
  const buf = bytes(1000);
  const r = await mediaResponse(req('bytes=100-199'), makeStorage(buf), 'k', { size: 1000 });
  assert.equal(r.status, 206);
  assert.equal(r.headers.get('content-range'), 'bytes 100-199/1000');
  assert.equal(r.headers.get('content-length'), '100');
  assert.equal(r.headers.get('accept-ranges'), 'bytes');
  const got = new Uint8Array(await r.arrayBuffer());
  assert.deepEqual([...got], [...buf.slice(100, 200)]);
});

test('后缀 Range（bytes=-50）取末尾 50 字节', async () => {
  const buf = bytes(1000);
  const r = await mediaResponse(req('bytes=-50'), makeStorage(buf), 'k', { size: 1000 });
  assert.equal(r.status, 206);
  assert.equal(r.headers.get('content-range'), 'bytes 950-999/1000');
  assert.equal((await r.arrayBuffer()).byteLength, 50);
});

test('首个 bytes=0- 请求会被裁到 4MB，不会一次穿过 Worker', async () => {
  const size = MAX_MEDIA_CHUNK * 2 + 123;
  const buf = bytes(size);
  const r = await mediaResponse(req('bytes=0-'), makeStorage(buf), 'k', { size });
  assert.equal(r.status, 206);
  assert.equal(r.headers.get('content-range'), `bytes 0-${MAX_MEDIA_CHUNK - 1}/${size}`);
  assert.equal(r.headers.get('content-length'), String(MAX_MEDIA_CHUNK));
  assert.equal((await r.arrayBuffer()).byteLength, MAX_MEDIA_CHUNK);
});

test('越界 Range 退回 200，而不是拼出错误的 Content-Range', async () => {
  const buf = bytes(100);
  const r = await mediaResponse(req('bytes=500-600'), makeStorage(buf), 'k', { size: 100 });
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('content-range'), null);
});

test('size 缺失但带 Range 时，用 head() 补出总长度', async () => {
  const buf = bytes(1000);
  const r = await mediaResponse(req('bytes=0-9'), makeStorage(buf), 'k', {});
  assert.equal(r.status, 206);
  assert.equal(r.headers.get('content-range'), 'bytes 0-9/1000');
  assert.equal((await r.arrayBuffer()).byteLength, 10);
});

test('代理拿不到对象时退回公网直链（对象存储原生支持 Range）', async () => {
  const storage = {
    ...makeStorage(bytes(10)),
    get: async () => null,
    publicUrl: () => 'https://cdn.example.com/k',
  };
  const r = await mediaResponse(req('bytes=0-4'), storage, 'k', { size: 10 });
  assert.equal(r.status, 302);
  assert.equal(r.headers.get('location'), 'https://cdn.example.com/k');
});

test('代理拿不到且没有直链时返回 404', async () => {
  const storage = { ...makeStorage(bytes(10)), get: async () => null, publicUrl: () => null };
  const r = await mediaResponse(req(), storage, 'k', { size: 10 });
  assert.equal(r.status, 404);
});

test('没传 mime 时用对象存储的 contentType', async () => {
  const r = await mediaResponse(req(), makeStorage(bytes(10), 'audio/mpeg'), 'k', { size: 10 });
  assert.equal(r.headers.get('content-type'), 'audio/mpeg');
});

test('etag 会被透传，方便浏览器做片段缓存', async () => {
  const r = await mediaResponse(req(), makeStorage(bytes(10)), 'k', { size: 10 });
  assert.equal(r.headers.get('etag'), '"abc"');
});

test('后端：/stream 路由存在，且在线播放不会扣下载次数', () => {
  const index = read('src/index.ts');
  // 路由写的是正则 /^\/stream\/(...)$/，用字符串包含比再拼一层正则稳
  assert.ok(index.includes('\\/stream\\/'), '入口里缺 /stream 路由');
  assert.ok(index.includes('mediaStream('), '路由没接到 mediaStream');
  assert.match(index, /return mediaResponse\(request, storage, row\.key/, '后台预览没走 mediaResponse');

  const share = read('src/share.ts');
  const body = share.slice(share.indexOf('export async function mediaStream'), share.indexOf('function redirectTo'));
  assert.ok(body.length > 200, '找不到 mediaStream 实现');
  assert.ok(!body.includes('UPDATE shares SET downloads'), '在线播放不该扣下载次数');
  assert.ok(!body.includes("action = 'download'"), '在线播放不该写 download 日志（会触发单 IP 限流误判）');
  for (const guard of ['isBanned', 'ipGuard', 'trafficGuard', 'verifyToken']) {
    assert.ok(body.includes(guard), `mediaStream 少了 ${guard} 校验`);
  }
});

test('前端：三处界面都放上了播放器，且指向正确的流地址', () => {
  const api = read('web/src/api.ts');
  assert.ok(api.includes('export function isVideo'), '缺 isVideo');
  assert.ok(api.includes('export function isAudio'), '缺 isAudio');

  const detail = read('web/src/views/admin/DetailPanel.vue');
  assert.match(detail, /<video\b/, '详情面板没有视频播放器');
  assert.match(detail, /<audio\b/, '详情面板没有音频播放器');
  assert.ok(detail.includes('/preview/${file.id}'), '详情面板没指向 /preview');

  const files = read('web/src/views/admin/FilesPanel.vue');
  assert.ok(files.includes('mediaId'), '文件列表缺媒体灯箱状态');
  assert.match(files, /<video\b/, '文件列表灯箱没有视频播放器');
  assert.ok(files.includes('@click.stop="mediaId = f.id"'), '卡片上缺播放按钮');

  const shareView = read('web/src/views/ShareView.vue');
  assert.ok(shareView.includes('/stream/${code}'), '分享页没指向 /stream');
  assert.match(shareView, /<video\b/, '分享页没有视频播放器');
  assert.match(shareView, /<audio\b/, '分享页没有音频播放器');
  assert.ok(shareView.includes('canPlayMedia'), '带密码的分享不该在验证前渲染播放器');

  assert.ok(read('web/src/style.css').includes('.play-badge {'), '缺播放按钮样式');
});
