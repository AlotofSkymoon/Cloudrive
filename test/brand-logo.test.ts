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

const BACKEND = read('src/logo.ts');
const FRONTEND = read('web/src/logo.ts');

test('后端与前端的品牌图形模板完全一致', () => {
  // 前端不能 import src/logo.ts（vite root 是 web/），所以放了一份副本。
  // 副本必须与原件相同，否则 favicon 和界面上的图标会长得不一样。
  assert.equal(
    svgConst(FRONTEND, 'LOGO_SVG_TEMPLATE'),
    svgConst(BACKEND, 'LOGO_SVG_TEMPLATE'),
    '前端 logo 副本与 src/logo.ts 不一致'
  );
});

test('品牌图标是「云朵 + 文件夹 + 弧线」，不是通用云朵', () => {
  const tpl = svgConst(BACKEND, 'LOGO_SVG_TEMPLATE');
  // 三个圆 + 一个圆角矩形构成云朵轮廓
  assert.match(tpl, /<circle/, '缺云朵的圆');
  assert.match(tpl, /<rect[^>]*rx=/, '缺云朵的矩形基座');
  // 配色靠占位符替换，一份图形出三种颜色
  for (const token of ['__CLOUD__', '__FOLDER__', '__ARC__']) {
    assert.ok(tpl.includes(token), `缺占位符 ${token}`);
  }
  // 不能是 M3 那个通用云朵图标
  assert.ok(!/M19\.35 10\.04/.test(tpl), '图标退化成了 M3 的通用云朵');
});

test('品牌图标不含文字', () => {
  const tpl = svgConst(BACKEND, 'LOGO_SVG_TEMPLATE');
  assert.ok(!/<text\b/.test(tpl), '图标里不该有 text 元素');
});

test('三种配色都要渲染出来，不能退化成同一份', () => {
  // 直接把渲染逻辑抄过来跑一遍（这里不 import .ts，避免 vitest 之外的构建依赖）
  const tpl = svgConst(BACKEND, 'LOGO_SVG_TEMPLATE');
  const INK = '#101418';
  const render = (v) => {
    const p =
      v === 'black'
        ? { cloud: INK, folder: '#ffffff', arc: '#ffffff' }
        : v === 'white'
          ? { cloud: '#ffffff', folder: INK, arc: INK }
          : { cloud: 'url(#g)', folder: '#ffffff', arc: '#ffffff' };
    let svg = tpl
      .replace('__CLOUD__', p.cloud)
      .replace('__FOLDER__', p.folder)
      .replace('__ARC__', p.arc);
    // 和 src/logo.ts 的 renderLogo 一致：黑白配色要把 <defs> 渐变整段去掉，
    // 否则会留一份没用的蓝色定义
    if (v !== 'color') svg = svg.replace(/<defs>[\s\S]*?<\/defs>/, '');
    return svg;
  };
  const color = render('color');
  const black = render('black');
  const white = render('white');

  // 彩色用渐变
  assert.match(color, /url\(#g\)/, '彩色版应该用渐变');
  // 黑白用实色，且互为反色
  assert.ok(black.includes(INK) && !black.includes('#1976d2'), '黑色版不该还有蓝色渐变');
  assert.ok(white.includes('fill="#ffffff"') && white.includes(INK), '白色版应该是白云 + 深文件夹');
  // 三者互不相同
  assert.notEqual(color, black);
  assert.notEqual(black, white);
  // 都不含残留占位符
  for (const [n, s] of [['color', color], ['black', black], ['white', white]]) {
    assert.ok(!/__CLOUD__|__FOLDER__|__ARC__/.test(s), `${n} 版还有未替换的占位符`);
  }
});

test('每个实例的渐变 id 唯一（同页面多实例不会互相覆盖）', () => {
  const tpl = svgConst(BACKEND, 'LOGO_SVG_TEMPLATE');
  // 组件里的做法：先替换占位符，再把 id="g" / url(#g) 换成唯一 id
  const withUid = tpl
    .replace('__CLOUD__', 'url(#g)')
    .replace('__FOLDER__', '#ffffff')
    .replace('__ARC__', '#ffffff')
    .replace(/id="g"/g, 'id="brand-logo-x1"')
    .replace(/url\(#g\)/g, 'url(#brand-logo-x1)');
  assert.ok(!withUid.includes('id="g"'), '还留着固定 id="g"');
  assert.ok(!withUid.includes('url(#g)'), '还引用着固定 url(#g)');
  assert.match(withUid, /id="brand-logo-x1"/);
  assert.match(withUid, /url\(#brand-logo-x1\)/);

  // 组件源码里确实这么做了
  const comp = read('web/src/components/BrandLogo.vue');
  assert.ok(comp.includes('renderLogoInner'), '组件没用 renderLogoInner');
  assert.ok(/uid|unique/i.test(comp), '组件没生成唯一 id');
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
  assert.match(src, /M19\.35 10\.04[^"]*ZM14 13v4h-4v-4H7/, '拖拽区上传图标不该被换掉');
});

test('图标配色可在设置里切换，且值会被后端规范化', () => {
  const settings = read('web/src/views/admin/SettingsPanel.vue');
  assert.match(settings, /logoVariant/, '设置页没有图标配色项');
  for (const v of ['color', 'black', 'white', 'auto']) {
    assert.ok(settings.includes(`value="${v}"`), `设置页缺 ${v} 选项`);
  }

  // 选项文案是产品命名：黑色叫「零白」，白色叫「原白」
  assert.ok(settings.includes('>零白<'), '零白（黑）的文案不对');
  assert.ok(settings.includes('>原白<'), '原白（白）的文案不对');
  assert.ok(!settings.includes('>黑色<'), '不该再出现「黑色」');
  assert.ok(!settings.includes('>白色<'), '不该再出现「白色」');

  const db = read('src/db.ts');
  assert.match(db, /LOGO_VARIANT:\s*'color'/, '默认配置缺 LOGO_VARIANT');
  assert.match(db, /normalizeLogoVariant/, '缺非法值回落逻辑');
  // 非法值必须回落 color，不能把奇怪的值写进库
  assert.match(db, /s === 'black' \|\| s === 'white' \|\| s === 'auto' \? s : 'color'/, '回落逻辑不对');

  // 保存白名单里要有它，否则前端改了存不进去
  const idx = read('src/index.ts');
  assert.match(idx, /LOGO_VARIANT:\s*b\.logoVariant/, '配置保存接口没有收 LOGO_VARIANT');
});

test('favicon 路由与页面声明都在，且支持黑白版', () => {
  const index = read('src/index.ts');
  assert.match(index, /'\/favicon\.ico'/, 'index.ts 缺 /favicon.ico 路由');
  assert.match(index, /'\/favicon\.svg'/, 'index.ts 缺 /favicon.svg 路由');
  assert.match(index, /searchParams\.get\('v'\)/, 'favicon 不支持 ?v= 取黑白版');

  const page = read('src/page.ts');
  assert.match(page, /rel="icon"[^>]*/, '服务端模板缺 <link rel="icon">');
  assert.match(page, /href="\/favicon\.svg"/, '服务端模板没指向 /favicon.svg');
  // faviconResponse 要能接受配色参数
  assert.match(page, /faviconResponse\(variant/, 'faviconResponse 不接受配色参数');

  const html = read('web/index.html');
  assert.match(html, /rel="icon"[^>]*/, 'web/index.html 缺 <link rel="icon">');
});
