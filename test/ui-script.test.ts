// 页面外壳必须把首屏数据和前端产物正确塞进去。
// 以前页面是手写模板，曾因为内联脚本转义写坏导致整段 JS 报废、页面卡在「加载中…」；
// 现在前端由 Vue3 + Tailwind 构建，这里改为校验外壳本身。
import { test } from 'vitest';
import assert from 'node:assert/strict';
import { spaHtml, errorResponse, faviconResponse } from '../src/page';

function parseBoot(html: string) {
  const m = /window\.__FILECOVE__=(\{[\s\S]*?\});<\/script>/.exec(html);
  assert.ok(m, '页面里找不到 window.__FILECOVE__ 注入');
  return JSON.parse(m[1]);
}

test('页面外壳带 doctype / 视口 / 图标 / 样式', () => {
  const h = spaHtml({ view: 'admin' });
  assert.ok(h.startsWith('<!doctype html>'), '缺 doctype');
  assert.ok(h.includes('name="viewport"'), '缺视口声明');
  assert.ok(h.includes('rel="icon"') && h.includes('/favicon.svg'), '缺站点图标');
  assert.ok(h.includes('<style>') && h.includes('</style>'), '缺内联样式');
  assert.ok(h.includes('<div id="app"></div>'), '缺挂载点');
  assert.ok(h.includes('<script type="module">'), '缺前端入口');
});

test('四种视图都能渲染，且 view 字段正确', () => {
  for (const v of ['admin', 'login', 'share', 'error']) {
    const h = spaHtml({ view: v as any });
    assert.equal(parseBoot(h).view, v, `${v} 视图的 boot.view 不对`);
  }
});

test('boot 数据按 JSON 注入且被正确转义', () => {
  const h = spaHtml({ view: 'share', boot: { code: 'a"b', name: '<script>' } });
  const boot = parseBoot(h);
  assert.equal(boot.code, 'a"b');
  assert.equal(boot.name, '<script>');
  // 注入的内容不能提前闭合 script 标签
  assert.ok(!/<script>[\s\S]*?<script>\s*<\/script>/.test(h.replace('<script type="module">', '')), '注入内容闭合了 script 标签');
});

test('title 会被转义，避免破坏 head', () => {
  const h = spaHtml({ view: 'admin', title: 'a"b<c>' });
  assert.ok(h.includes('a&quot;b&lt;c&gt;'), 'title 没转义');
});

test('错误页返回真正的 Response 并带状态码', async () => {
  const r404 = errorResponse('404', '页面不存在：/x');
  assert.equal(r404.status, 404, '404 状态码不对');
  const body = await r404.text();
  assert.equal(parseBoot(body).error.code, '404');

  // 非数字状态码（如「链接不存在」）回落到 200，不能抛异常
  const rText = errorResponse('链接不存在', '这个分享链接无效');
  assert.equal(rText.status, 200);
});

test('favicon 是 SVG 图形且不含文字', async () => {
  const r = faviconResponse();
  assert.ok((r.headers.get('content-type') || '').includes('svg'));
  const svg = await r.text();
  assert.ok(svg.startsWith('<svg'), '不是 SVG');
  assert.ok(svg.includes('circle'), '缺图形元素');
  assert.ok(!/<text\b/.test(svg), '图标里不该有文字');
});
