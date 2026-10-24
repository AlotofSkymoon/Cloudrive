// 品牌图标的一致性检查。
// 之前的教训：界面改造时把品牌 logo 换成了通用云朵图标，用户的自定义
// 图形（云朵 + 文件夹 + 右下弧线）只剩 favicon 还在用，界面和图标对不上。
// 这里把几处钉住，防止再发生。
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'vitest';
import assert from 'node:assert/strict';

const ROOT = join(__dirname, '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

/** 取出 `export const X = \`...\`` 里的模板字符串内容 */
function svgConst(src: string, name: string): string {
  const re = new RegExp(`export const ${name}\\s*=\\s*\`([\\s\\S]*?)\`;`);
  const m = re.exec(src);
  assert.ok(m, `找不到 export const ${name}`);
  return m[1];
}

test('后端与前端的品牌 SVG 完全一致', () => {
  // 前端不能 import src/logo.ts（vite root 是 web/），所以放了一份副本。
  // 副本必须与原件相同，否则 favicon 和界面上的图标会长得不一样。
  const backend = svgConst(read('src/logo.ts'), 'LOGO_SVG');
  const frontend = svgConst(read('web/src/logo.ts'), 'BRAND_LOGO_SVG');
  assert.equal(frontend, backend, '前端 logo 副本与 src/logo.ts 不一致');
});

test('品牌图标是「云朵 + 文件夹 + 弧线」，不是通用云朵', () => {
  const svg = svgConst(read('src/logo.ts'), 'LOGO_SVG');
  // 三个圆 + 一个圆角矩形构成云朵轮廓
  assert.match(svg, /<circle/, '缺云朵的圆');
  assert.match(svg, /<rect[^>]*rx=/, '缺云朵的矩形基座');
  // 白色文件夹
  assert.match(svg, /fill="#fff"/, '缺白色文件夹');
  // 右下白色弧线
  assert.match(svg, /stroke="#fff"[^>]*stroke-linecap="round"/, '缺右下白色弧线');
  // 不能是 M3 那个通用云朵图标
  assert.ok(!/M19\.35 10\.04/.test(svg), '图标退化成了 M3 的通用云朵');
});

test('品牌图标不含文字', () => {
  const svg = svgConst(read('src/logo.ts'), 'LOGO_SVG');
  assert.ok(!/<text\b/.test(svg), '图标里不该有 text 元素');
});

test('所有页面都用品牌图标组件，没有残留通用云朵', () => {
  // 例外：FilesPanel 拖拽区的上传图标是功能性的（带向上箭头），保留
  const views = [
    'web/src/views/AdminView.vue',
    'web/src/views/LoginView.vue',
    'web/src/views/ShareView.vue',
    'web/src/views/ErrorView.vue',
  ];
  for (const f of views) {
    const src = read(f);
    assert.ok(src.includes("from '../components/BrandLogo.vue'"), `${f} 没有引入 BrandLogo`);
    assert.ok(/<BrandLogo\b/.test(src), `${f} 模板里没用 BrandLogo`);
    assert.ok(!/M19\.35 10\.04/.test(src), `${f} 还留着通用云朵图标`);
  }
});

test('拖拽区的上传图标保留（它是功能图标，不是品牌 logo）', () => {
  const src = read('web/src/views/admin/FilesPanel.vue');
  // 带箭头的那个：M19.35 10.04 ... ZM14 13v4h-4v-4H7l5-5 5 5h-3Z
  assert.match(src, /M19\.35 10\.04[^"]*ZM14 13v4h-4v-4H7/, '拖拽区上传图标不该被换掉');
});

test('favicon 路由与页面声明都在', () => {
  const index = read('src/index.ts');
  assert.match(index, /'\/favicon\.ico'/, 'index.ts 缺 /favicon.ico 路由');
  assert.match(index, /'\/favicon\.svg'/, 'index.ts 缺 /favicon.svg 路由');

  const page = read('src/page.ts');
  assert.match(page, /rel="icon"[^>]*/, '服务端模板缺 <link rel="icon">');
  assert.match(page, /href="\/favicon\.svg"/, '服务端模板没指向 /favicon.svg');

  const html = read('web/index.html');
  assert.match(html, /rel="icon"[^>]*/, 'web/index.html 缺 <link rel="icon">');
});

test('BrandLogo 组件给渐变 id 加了唯一后缀', () => {
  // SVG 的 id 是文档级全局的，同页面多个实例用同一个 id 会互相覆盖
  const src = read('web/src/components/BrandLogo.vue');
  assert.match(src, /uid|unique/i, '没有生成唯一 id 的逻辑');
  // 用 includes 而不是正则——源码里是正则字面量 /url\(#g\)/，括号带转义，
  // 写成正则来匹配它容易陷进转义地狱
  assert.ok(src.includes('replace(/id="g"/'), '没有替换 defs 里的 id="g"');
  assert.ok(src.includes('url\\(#g\\)'), '没有替换 fill 引用的 url(#g)');
});
