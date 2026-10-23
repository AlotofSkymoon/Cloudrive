// 品牌图标：蓝色云朵 + 白色文件夹 + 右下白色弧线（不带文字）
// 纯内联 SVG，无外部请求，用于 favicon 与页面左上角。
export const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3b82f6"/><stop offset="1" stop-color="#1d4ed8"/></linearGradient></defs>
<g fill="url(#g)"><circle cx="22" cy="32" r="10"/><circle cx="34" cy="26" r="13"/><circle cx="46" cy="32" r="9.5"/><rect x="18" y="31" width="32" height="11" rx="5.5"/></g>
<path d="M22 22 h8.5 l3 3.2 h9.5 a2.2 2.2 0 0 1 2.2 2.2 v6.6 a2.2 2.2 0 0 1 -2.2 2.2 H22 a2.2 2.2 0 0 1 -2.2 -2.2 v-9.8 a2.2 2.2 0 0 1 2.2 -2.2 z" fill="#fff"/>
<path d="M27 42 q13 -1.5 20 -11.5" stroke="#fff" stroke-width="3.6" fill="none" stroke-linecap="round"/>
</svg>`;

// 站点图标（favicon）直接复用同一个图形
export function faviconResponse() {
  return new Response(LOGO_SVG, {
    headers: {
      'content-type': 'image/svg+xml; charset=utf-8',
      'cache-control': 'public, max-age=86400',
    },
  });
}
