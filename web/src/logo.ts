// 品牌图标：蓝色云朵 + 白色文件夹 + 右下白色弧线（不带文字）
// 与 src/logo.ts 的 LOGO_SVG 完全一致——test/brand-logo.test.ts 会比对两边，
// 改动其中一个而忘了另一个会直接测试失败。
// 前端不能 import ../../src/logo.ts（vite root 是 web/，跨 root 导入构建有风险），
// 所以这里放一份副本，靠测试保证同步。
export const BRAND_LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#42a5f5"/><stop offset="1" stop-color="#1976d2"/></linearGradient></defs>
<g fill="url(#g)"><circle cx="22" cy="32" r="10"/><circle cx="34" cy="26" r="13"/><circle cx="46" cy="32" r="9.5"/><rect x="18" y="31" width="32" height="11" rx="5.5"/></g>
<path d="M22 22 h8.5 l3 3.2 h9.5 a2.2 2.2 0 0 1 2.2 2.2 v6.6 a2.2 2.2 0 0 1 -2.2 2.2 H22 a2.2 2.2 0 0 1 -2.2 -2.2 v-9.8 a2.2 2.2 0 0 1 2.2 -2.2 z" fill="#fff"/>
<path d="M27 42 q13 -1.5 20 -11.5" stroke="#fff" stroke-width="3.6" fill="none" stroke-linecap="round"/>
</svg>`;

/** 图标里的图形部分（去掉外层 <svg>，用于内联到组件模板） */
export const BRAND_LOGO_INNER = BRAND_LOGO_SVG.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
