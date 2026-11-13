// 媒体在线预览：图片 / 视频 / 音频。
// <video> 和 <audio> 靠 HTTP Range 做边下边播、拖动进度条。服务端必须
// 返回 206 + Content-Range + Accept-Ranges，否则浏览器只能整段下载，
// 大文件播不动、进度条也拖不了。图片预览走同一套，顺带获得 Range 能力。
import { parseRange, redirect } from './util.js';

// 单次 Range 响应最多给 4 MB。
// 浏览器对 <video> 的首个请求通常是 `Range: bytes=0-`（等于伸手要全片），
// 不裁的话一个 500 MB 的视频会一次性穿过 Worker，流量和内存都吃不消。
// 返回 206 且只给前 4 MB，浏览器会接着按段请求，播放和 seek 都不受影响。
export const MAX_MEDIA_CHUNK = 4 * 1024 * 1024;

export interface MediaOpts {
  mime?: string;
  size?: number;
  cache?: string;
}

/**
 * 把对象存储里的一个文件按 Range 吐出去。
 * 调用方负责鉴权；这里只管字节流和响应头。
 */
export async function mediaResponse(request: any, storage: any, key: string, opts: MediaOpts = {}): Promise<Response> {
  let total = Math.max(0, Number(opts.size) || 0);
  const rangeHeader = request.headers.get('range');

  // 数据库里 size 偶尔缺失（比如早期同步进来的对象），带 Range 时要补一次 head，
  // 否则 Content-Range 里的总数会算错，浏览器直接放弃播放。
  if (!total && rangeHeader && storage.head) {
    const h = await storage.head(key);
    if (h && h.size) total = Number(h.size) || 0;
  }

  let range = total ? parseRange(rangeHeader, total) : null;
  if (range && range.length > MAX_MEDIA_CHUNK) {
    range = { offset: range.offset, length: MAX_MEDIA_CHUNK };
  }

  const obj = await storage.get(key, range || undefined);
  if (!obj) {
    // 代理拿不到对象时退回直链：对象存储原生支持 Range，浏览器能直接播。
    // 这也是「公网域名配了却没开公开访问」之外的最后一层退路。
    const pub = storage.publicUrl ? storage.publicUrl(key) : null;
    if (pub) return redirect(pub);
    if (storage.presignGet) {
      const signed = await storage.presignGet(key, { expires: 900, download: false });
      if (signed) return redirect(signed);
    }
    return new Response('对象不存在', { status: 404 });
  }

  const headers = new Headers();
  headers.set('content-type', opts.mime || obj.contentType || 'application/octet-stream');
  headers.set('accept-ranges', 'bytes');
  headers.set('cache-control', opts.cache || 'private, max-age=300');
  if (obj.etag) headers.set('etag', obj.etag);

  if (range && total) {
    const from = range.offset;
    const to = from + range.length - 1;
    headers.set('content-range', `bytes ${from}-${to}/${total}`);
    headers.set('content-length', String(range.length));
    return new Response(obj.body, { status: 206, headers });
  }
  if (total) headers.set('content-length', String(total));
  else if (obj.size) headers.set('content-length', String(obj.size));
  return new Response(obj.body, { status: 200, headers });
}
