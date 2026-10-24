// 主题色（tint）：作用于**整个界面**的主色，不只是品牌图标。
// 之前设置里只有「图标配色」，那只改 logo，界面主色还是固定的蓝——
// 这个测试钉住两者是独立的配置项，且主题色确实接到了 CSS 变量上。
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'vitest';
import assert from 'node:assert/strict';

const ROOT = join(__dirname, '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

const THEME = read('web/src/theme.ts');
const CSS = read('web/src/style.css');

/** 主题色名（按 theme.ts 里的定义顺序） */
function tintNames(): string[] {
  return [...THEME.matchAll(/^ {2}(\w+): \{ base:/gm)].map((m) => m[1]);
}

test('主题色是独立的配置项，和图标配色分开', () => {
  // 用户要的是「整个 Cloudrive 的配色」，不是 logo 的配色
  assert.match(THEME, /主题色（tint）/ , 'theme.ts 没说明这是全局主色');
  assert.match(THEME, /export const tintSetting/, '缺 tintSetting');
  assert.match(THEME, /export const logoSetting/, '缺 logoSetting');
  // 两个是各自独立的 ref，不是同一个
  assert.ok(THEME.indexOf('tintSetting') !== THEME.indexOf('logoSetting'), '两者不该是同一个状态');
});

test('提供了 8 个主题色，每个都有浅色深色两套', () => {
  const names = tintNames();
  assert.equal(names.length, 8, `主题色应有 8 个，实际 ${names.length} 个`);
  for (const n of names) {
    const m = new RegExp(`^  ${n}: \\{([^}]*)\\}`, 'm').exec(THEME);
    assert.ok(m, `缺 ${n} 的定义`);
    for (const k of ['base', 'hover', 'darkBase', 'darkHover']) {
      assert.match(m[1], new RegExp(`${k}:`), `${n} 缺 ${k}`);
    }
    // 值是空格分隔的 RGB 三元组，供 rgb(var(--x) / <alpha-value>) 使用
    for (const mm of m[1].matchAll(/'(\d{1,3}) (\d{1,3}) (\d{1,3})'/g)) {
      for (const g of [mm[1], mm[2], mm[3]]) {
        const v = Number(g);
        assert.ok(v >= 0 && v <= 255, `${n} 的 RGB 值越界：${g}`);
      }
    }
  }
});

test('主题色写进 CSS 变量（inline style 覆盖 :root）', () => {
  // CSS 变量 --c-tint 是全局主色的唯一来源，Tailwind 的 primary 读它
  assert.match(CSS, /--c-tint:/, 'CSS 里没有 --c-tint');
  assert.match(read('tailwind.config.js'), /var\(--c-tint\)/, 'Tailwind 的 primary 没读 --c-tint');

  const m = /function applyTint\(\)[\s\S]*?\n}/.exec(THEME);
  assert.ok(m, '缺 applyTint');
  assert.match(m[0], /setProperty\('--c-tint'/, '没有写 --c-tint');
  assert.match(m[0], /documentElement/, '没写到根元素');
  // 深色模式要用另一组值
  assert.match(m[0], /prefersDark\.value/, '深色模式没有用另一套色值');
});

test('非法主题色回落蓝色，不会写坏 CSS 变量', () => {
  const m = /export function normalizeTint[\s\S]*?\n}/.exec(THEME);
  assert.ok(m, '缺 normalizeTint');
  assert.match(m[0], /'blue'/, '没有回落到 blue');
});

test('前后端的主题色名完全一致', () => {
  // 后端白名单漏一个，前端选了就存不进去（静默回落成蓝色）
  const fe = tintNames();
  const m = /const TINT_NAMES_BACKEND = \[([^\]]*)\]/.exec(read('src/db.ts'));
  assert.ok(m, '后端缺 TINT_NAMES_BACKEND');
  const be = [...m[1].matchAll(/'(\w+)'/g)].map((x) => x[1]);
  const diff = fe.filter((x) => !be.includes(x)).concat(be.filter((x) => !fe.includes(x)));
  assert.deepEqual(diff, [], `前后端色名不一致：${diff.join(', ')}`);
});

test('后端会把 tint 存库并回传', () => {
  const db = read('src/db.ts');
  assert.match(db, /TINT: 'blue'/, '默认设置里没有 TINT');
  assert.match(db, /tint: normalizeTint\(pick\('TINT', 'blue'\)\)/, 'config() 没有返回 tint');
  assert.match(read('src/index.ts'), /TINT: b\.tint \? db\.normalizeTint\(b\.tint\)/, '保存接口没有接收 tint');
});

test('设置页有主题色选项，且改了能立刻预览', () => {
  const sp = read('web/src/views/admin/SettingsPanel.vue');
  assert.match(sp, /主题色/, '设置页没有主题色');
  assert.match(sp, /v-model="cfg\.tint"/, '主题色没有绑定');
  assert.match(sp, /@change="onTintChange"/, '改主题色没有即时预览');
  // 即时预览要真的调用 setTint（不只是标记 dirty）
  assert.match(sp, /setTint\(cfg\.tint\)/, 'onTintChange 没有调用 setTint');
  // 保存时要带上
  assert.match(sp, /tint: cfg\.tint,/, '保存请求没带上 tint');
});

test('图标配色仍然存在，但说明清楚它只影响图标', () => {
  // 用户澄清过：图标配色 ≠ 界面配色。两个都要在，别被主题色取代
  const sp = read('web/src/views/admin/SettingsPanel.vue');
  assert.match(sp, /图标配色/, '图标配色被误删了');
  assert.match(sp, /只影响品牌图标本身/, '没说明图标配色只影响图标');
  // 零白 / 原白
  assert.match(sp, /零白/, '缺零白');
  assert.match(sp, /原白/, '缺原白');
});

test('保存按钮的文案就是「保存」', () => {
  const sp = read('web/src/views/admin/SettingsPanel.vue');
  assert.match(sp, /@click="save">保存</, '保存按钮文案不是「保存」');
});
