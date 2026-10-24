// 品牌图标：蓝色云朵 + 白色文件夹 + 右下白色弧线（不带文字）
// 与 src/logo.ts 的 LOGO_SVG_TEMPLATE 完全一致——test/brand-logo.test.ts 会比对两边，
// 改动其中一个而忘了另一个会直接测试失败。
// 前端不能 import ../../src/logo.ts（vite root 是 web/，跨 root 导入构建有风险），
// 所以这里放一份副本，靠测试保证同步。
export const LOGO_SVG_TEMPLATE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#42a5f5"/><stop offset="1" stop-color="#1976d2"/></linearGradient></defs>
<g fill="__CLOUD__"><circle cx="22" cy="32" r="10"/><circle cx="34" cy="26" r="13"/><circle cx="46" cy="32" r="9.5"/><rect x="18" y="31" width="32" height="11" rx="5.5"/></g>
<path d="M22 22 h8.5 l3 3.2 h9.5 a2.2 2.2 0 0 1 2.2 2.2 v6.6 a2.2 2.2 0 0 1 -2.2 2.2 H22 a2.2 2.2 0 0 1 -2.2 -2.2 v-9.8 a2.2 2.2 0 0 1 2.2 -2.2 z" fill="__FOLDER__"/>
<path d="M27 42 q13 -1.5 20 -11.5" stroke="__ARC__" stroke-width="3.6" fill="none" stroke-linecap="round"/>
</svg>`;

export type LogoVariant = 'color' | 'black' | 'white';

const INK = '#101418';

const PALETTE = {
  color: { cloud: 'url(#g)', folder: '#ffffff', arc: '#ffffff' },
  black: { cloud: INK, folder: '#ffffff', arc: '#ffffff' },
  white: { cloud: '#ffffff', folder: INK, arc: INK },
};

export const LOGO_VARIANTS = ['color', 'black', 'white'];

/** 渲染指定配色的图标（uid 让同页面多个实例的渐变 id 不冲突） */
export function renderLogo(variant = 'color', uid = 'g') {
  const p = PALETTE[variant] || PALETTE.color;
  let svg = LOGO_SVG_TEMPLATE.replace('__CLOUD__', p.cloud)
    .replace('__FOLDER__', p.folder)
    .replace('__ARC__', p.arc);
  if (variant === 'color') {
    svg = svg.replace(/id="g"/g, `id="${uid}"`).replace(/url\(#g\)/g, `url(#${uid})`);
  } else {
    // 黑白配色用不到渐变，把 defs 整段去掉，免得留一份没用的蓝色定义
    svg = svg.replace(/<defs>[\s\S]*?<\/defs>/, '');
  }
  return svg;
}

/** 图标里的图形部分（去掉外层 <svg>），用于内联到组件模板 */
export function renderLogoInner(variant = 'color', uid = 'g') {
  return renderLogo(variant, uid)
    .replace(/^<svg[^>]*>/, '')
    .replace(/<\/svg>\s*$/, '');
}
