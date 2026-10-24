// 品牌图标：蓝色云朵 + 白色文件夹 + 右下白色弧线（不带文字）
//
// 同一份图形支持三种配色，供「黑白切换」用：
//   color —— 蓝色渐变云朵 + 白色文件夹 + 白色弧线（默认，也是 favicon 用的）
//   black —— 近黑云朵 + 白色文件夹 + 白色弧线（浅色背景）
//   white —— 白色云朵 + 近黑文件夹 + 近黑弧线（深色背景）
//
// 图形只写一份模板，配色靠替换占位符实现，避免三份 SVG 各自漂移。
// 纯内联，无外部请求。
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

export function isLogoVariant(v) {
  return v === 'color' || v === 'black' || v === 'white';
}

/**
 * 渲染指定配色的图标。
 * uid 用来替换渐变 id —— SVG 的 id 是文档级全局的，同页面多个实例
 * 共用 id="g" 会互相覆盖导致颜色错乱，所以每个实例要一个唯一 id。
 */
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

// 默认（彩色）版本，favicon 用
export const LOGO_SVG = renderLogo('color', 'g');
