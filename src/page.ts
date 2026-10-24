// 页面外壳：把前端（Vue3 + Tailwind 的构建产物）连同首屏数据一起吐出去。
// 前端构建一次，产物内联在这里，Worker 不需要静态资源绑定。
import { APP_JS, APP_CSS } from './web-assets.js';
import { renderLogo } from './logo.js';

export const VERSION = '1.8.4';

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

// 前端资源有没有构建过。
// web-assets.ts 在仓库里是哨兵占位（见该文件头注释），只有 npm run build
// 才会写入真产物。构建步骤一旦没执行（比如 Actions 里 build 被跳过、
// 或控制台部署没配 build command），页面会是个空壳并且看不出原因——
// 之前就是这样静默部署了几个月的旧界面。这里显式兜住，直接说明问题。
// 哨兵值，与 src/web-assets.ts 的占位一致
const ASSETS_SENTINEL = '__CLOUDRIVE_ASSETS_NOT_BUILT__';
// 用 String() 包一层：构建后 APP_JS 会被推断成具体的长字面量类型，
// 直接和哨兵字面量比较，tsc 会判成「两个字面量无重叠」报 TS2367。
// （CI 里 build 先于 typecheck 跑，所以这条在真产物下必然触发）
export const ASSETS_BUILT = String(APP_JS) !== ASSETS_SENTINEL;

/** 没构建时的说明页：告诉运维该怎么修，而不是给一个空白/过期的界面 */
function notBuiltHtml(): string {
  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<title>前端资源未构建 · Cloudrive</title>
<style>
body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
background:#F7F9FC;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif;color:#1A1C1E}
.c{max-width:520px;padding:32px;background:#fff;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,.3),0 4px 8px 3px rgba(0,0,0,.15)}
h1{margin:0 0 12px;font-size:18px;font-weight:500}
p{margin:0 0 10px;font-size:14px;line-height:1.6;color:#44484D}
code{font-family:ui-monospace,SF Mono,Menlo,Consolas,monospace;background:#F2F5F8;
padding:2px 6px;border-radius:4px;font-size:13px}
ol{margin:8px 0 0;padding-left:20px;font-size:14px;line-height:1.8;color:#44484D}
</style></head>
<body><div class="c">
<h1>前端资源未构建</h1>
<p>Worker 已经在跑，但前端（Vue3 + Tailwind）的构建产物是占位内容，说明 <code>npm run build</code> 没有执行。</p>
<p>请按下面任一步骤处理后重新部署：</p>
<ol>
<li>用 GitHub Actions 部署：工作流会依次执行 <code>build</code> → <code>typecheck</code> → <code>test</code>，构建一定有跑；查看日志里是否有 <code>vite build</code> 成功。</li>
<li>用 Cloudflare 控制台「连接 GitHub」部署：确认 <code>wrangler.toml</code> 里的 <code>[build] command</code> 生效（<code>npm install &amp;&amp; npm run build</code>）。</li>
<li>本地部署：先执行 <code>npm install &amp;&amp; npm run build</code>，再 <code>npx wrangler deploy</code>。</li>
</ol>
</div></body></html>`;
}

export function spaHtml(o: SpaOptions): string {
  if (!ASSETS_BUILT) return notBuiltHtml();
  const boot = JSON.stringify({ view: o.view, version: VERSION, ...(o.boot || {}) });
  const title = o.title || 'Cloudrive';
  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#00639B">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="apple-touch-icon" href="/favicon.svg">
<title>${esc(title)}</title>
<style>${APP_CSS}</style></head>
<body>
<div id="app"></div>
<script>window.__CLOUDRIVE__=${boot};</script>
<script type="module">${APP_JS}</script>
</body></html>`;
}

/* ---------- 站点图标（云朵 + 文件夹，不带文字） ----------
   默认彩色；传 black / white 取黑白版。 */
export function faviconResponse(variant = 'color'): Response {
  return new Response(renderLogo(variant), {
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
      title: `${code} · Cloudrive`,
      boot: { error: { code: String(code), msg } },
    }),
    { status: ok ? status : 200, headers: { 'content-type': 'text/html; charset=utf-8' } }
  );
}
