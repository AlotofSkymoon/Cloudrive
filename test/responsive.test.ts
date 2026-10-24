// 设备适配的防回归测试。
// 目标：手机 / 平板 / 桌面都能正常用，不出现横向滚动、点按区域过小、
// 断点不一致导致的错位。
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'vitest';
import assert from 'node:assert/strict';

const ROOT = join(__dirname, '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

/** 收集 web/src 下所有 .vue 文件 */
function vueFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.vue') || e.name.endsWith('.ts')) out.push(p);
    }
  };
  walk(join(ROOT, 'web/src'));
  return out;
}

const VIEWS = [
  'web/src/views/AdminView.vue',
  'web/src/views/LoginView.vue',
  'web/src/views/ShareView.vue',
  'web/src/views/ErrorView.vue',
  'web/src/views/admin/FilesPanel.vue',
  'web/src/views/admin/DetailPanel.vue',
  'web/src/views/admin/SharesPanel.vue',
  'web/src/views/admin/LogsPanel.vue',
  'web/src/views/admin/BansPanel.vue',
  'web/src/views/admin/SettingsPanel.vue',
];

test('不再使用各自为政的旧断点（860 / 900 / 1100）', () => {
  // 之前三个文件写了三个不同阈值，860~900px 区间里侧边栏已折叠、
  // 但设置页保存栏还偏移 300px。现在统一成 compact / stacked / inline。
  for (const f of vueFiles()) {
    const src = read(f);
    const hits = src.match(/max-\[(860|900|1100)px\]/g);
    assert.equal(hits, null, `${f} 里还写着旧断点 ${hits?.join(', ')}`);
  }
});

test('断点在 tailwind.config.js 里统一定义', () => {
  const cfg = read('tailwind.config.js');
  for (const key of ['compact', 'stacked', 'inline']) {
    assert.ok(new RegExp(`\\b${key}:`).test(cfg), `tailwind.config.js 缺 ${key} 断点`);
  }
  // 三个断点的数值必须自洽：compact 上限 < stacked 上限 < inline 下限
  assert.match(cfg, /compact:\s*\{\s*max:\s*'599px'\s*\}/, 'compact 应为 max 599px');
  assert.match(cfg, /stacked:\s*\{\s*max:\s*'899px'\s*\}/, 'stacked 应为 max 899px');
  assert.match(cfg, /inline:\s*\{\s*min:\s*'1200px'\s*\}/, 'inline 应为 min 1200px');
});

test('设置页保存栏与侧边栏用同一个折叠断点', () => {
  // 侧边栏在 stacked（≤899px）折叠成顶部导航，保存栏必须同时归零偏移
  const settings = read('web/src/views/admin/SettingsPanel.vue');
  assert.match(settings, /left-\[300px\]/, '保存栏在宽屏应偏移侧边栏宽度');
  assert.match(settings, /stacked:left-0/, '保存栏在折叠断点没有归零，会错位');
});

test('表格都有横向滚动容器', () => {
  // 手机上看表格，没有滚动容器会把整页撑出横向滚动条
  for (const f of ['web/src/views/admin/FilesPanel.vue', 'web/src/views/admin/LogsPanel.vue', 'web/src/views/admin/BansPanel.vue']) {
    const src = read(f);
    if (!src.includes('<table>')) continue;
    assert.ok(src.includes('table-scroll'), `${f} 的表格没有套 .table-scroll`);
    // 开闭标签要配对
    assert.equal((src.match(/<table>/g) || []).length, (src.match(/<\/table>/g) || []).length, `${f} 表格标签不配对`);
  }
});

test('样式里有视口高度 / 安全区 / 点按区域的兜底', () => {
  const css = read('web/src/style.css');
  assert.match(css, /\.h-viewport/, '缺 .h-viewport（100dvh）');
  assert.match(css, /\.min-h-viewport/, '缺 .min-h-viewport（100dvh）');
  assert.match(css, /env\(safe-area-inset-bottom/, '缺底部安全区适配（刘海屏/小黑条）');
  assert.match(css, /max-width:\s*599px/, '缺手机断点下的媒体查询');
  // M3 要求最小 48dp 点按区域，手机上至少 44px
  assert.match(css, /h-11/, '手机上没有加大点按区域');
});

test('页面禁止整页横向滚动', () => {
  const css = read('web/src/style.css');
  assert.match(css, /overflow-x:\s*hidden/, 'html/body 没有禁止横向滚动');
});

test('视口 meta 带 viewport-fit=cover（安全区生效的前提）', () => {
  for (const f of ['web/index.html', 'src/page.ts']) {
    const src = read(f);
    assert.match(src, /viewport-fit=cover/, `${f} 的 viewport meta 缺 viewport-fit=cover`);
    assert.match(src, /width=device-width/, `${f} 的 viewport meta 缺 width=device-width`);
  }
});

test('两个页面模板的主题色一致', () => {
  const html = read('web/index.html');
  const page = read('src/page.ts');
  assert.match(html, /content="#00639B"/, 'web/index.html 主题色不对');
  assert.match(page, /content="#00639B"/, 'src/page.ts 主题色不对');
});

test('详情面板在窄屏不是直接隐藏，而是底部抽屉', () => {
  const panel = read('web/src/views/admin/DetailPanel.vue');
  // 旧实现是 max-[1100px]:hidden，手机上点了文件没反应
  assert.ok(!/max-\[1100px\]:hidden/.test(panel), '详情面板还在窄屏被隐藏');
  assert.match(panel, /matchMedia/, '详情面板没有根据宽度切换形态');
  assert.match(panel, /min-width:\s*1200px/, '抽屉/内联的切换阈值不是 1200px');

  const admin = read('web/src/views/AdminView.vue');
  assert.ok(!/class="max-\[1100px\]:hidden"/.test(admin), 'AdminView 还在隐藏详情面板');
});

test('每个视图都用上了适配断点', () => {
  // 至少有一处 responsive 标记，避免整页完全没做适配
  for (const f of VIEWS) {
    const src = read(f);
    const ok = /(compact|stacked|inline|tablet):|min-h-viewport|h-viewport|pb-safe|table-scroll|max-w-sm|max-w-md/.test(src);
    assert.ok(ok, `${f} 看起来完全没做设备适配`);
  }
});
