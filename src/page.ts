// 页面外壳：把前端（Vue3 + Tailwind 的构建产物）连同首屏数据一起吐出去。
// 前端构建一次，产物内联在这里，Worker 不需要静态资源绑定。
import { APP_JS, APP_CSS } from './web-assets.js';
import { LOGO_SVG } from './logo.js';

export const VERSION = '1.2.0';

export type ViewName = 'admin' | 'login' | 'share' | 'error';

export interface SpaOptions {
  view: ViewName;
  title?: string;
  /** 注入给前端的首屏数据 */
  boot?: Record<string, unknown>;
}

function esc(s: unknown): string {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function spaHtml(o: SpaOptions): string {
  const boot = JSON.stringify({ view: o.view, version: VERSION, ...(o.boot || {}) });
  const title = o.title || 'Filecove';
  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#f4f2ec">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="apple-touch-icon" href="/favicon.svg">
<title>${esc(title)}</title>
<style>${APP_CSS}</style></head>
<body>
<div id="app"></div>
<script>window.__FILECOVE__=${boot};</script>
<script type="module">${APP_JS}</script>
</body></html>`;
}

/* ---------- 站点图标（云朵 + 文件夹，不带文字） ---------- */
export function faviconResponse(): Response {
  return new Response(LOGO_SVG, {
    headers: {
      'content-type': 'image/svg+xml; charset=utf-8',
      'cache-control': 'public, max-age=86400',
    },
  });
}

/* ---------- 错误页：仍然走前端，但带上状态码 ---------- */
export function errorResponse(code: string | number, msg: string): Response {
  const status = Number(code);
  const ok = Number.isFinite(status) && status >= 400 && status < 600;
  return new Response(
    spaHtml({
      view: 'error',
      title: `${code} · Filecove`,
      boot: { error: { code: String(code), msg } },
    }),
    { status: ok ? status : 200, headers: { 'content-type': 'text/html; charset=utf-8' } }
  );
}
