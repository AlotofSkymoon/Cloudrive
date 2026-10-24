// 白天 / 夜间模式（浅色 / 深色）的手动切换。
// 之前只能跟随系统，用户没法锁定——设置页加了「外观」选项后，
// data-theme 会写在 <html> 上覆盖 prefers-color-scheme。
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'vitest';
import assert from 'node:assert/strict';

const ROOT = join(__dirname, '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

const CSS = read('web/src/style.css');
const THEME = read('web/src/theme.ts');
const PAGE = read('src/page.ts');

/** 深色令牌在 CSS 里出现两次，取出来做对比 */
function darkBlocks(): string[] {
  const media = /@media \(prefers-color-scheme: dark\) \{\s*:root:not\(\[data-theme='light'\]\) \{([\s\S]*?)\n  \}\n\}/.exec(CSS);
  const attr = /:root\[data-theme='dark'\] \{([\s\S]*?)\n\}/.exec(CSS);
  assert.ok(media, '缺跟随系统的深色块');
  assert.ok(attr, "缺 [data-theme='dark'] 深色块");
  return [media[1], attr[1]];
}

test('深色令牌的两份副本逐字一致', () => {
  // CSS 没法复用规则集，只能写两遍。一旦改了一处忘另一处，
  // 「跟随系统」和「手动深色」会显示成两种不同颜色。
  const [a, b] = darkBlocks();
  const norm = (s: string) => s.replace(/\s+/g, ' ').trim();
  assert.equal(norm(a), norm(b), '两份深色令牌不一致');
});

test('手动浅色能覆盖系统的深色设置', () => {
  // 关键在 :not([data-theme='light'])——少了它，系统是深色时
  // 用户选「浅色」也不生效
  assert.match(
    CSS,
    /@media \(prefers-color-scheme: dark\) \{\s*:root:not\(\[data-theme='light'\]\)/,
    'media 里的深色块要用 :not([data-theme=\'light\']) 排除手动浅色'
  );
  // 手动深色要能覆盖系统的浅色
  assert.match(CSS, /:root\[data-theme='dark'\]/, '缺手动深色的选择器');
});

test('三种外观模式：跟随系统 / 浅色 / 深色', () => {
  assert.match(THEME, /export type AppearanceSetting = 'auto' \| 'light' \| 'dark'/, '缺三种模式定义');
  // 非法值回落 auto，不会写坏 data-theme
  const m = /export function normalizeAppearance[\s\S]*?\n}/.exec(THEME);
  assert.ok(m, '缺 normalizeAppearance');
  assert.match(m[0], /'auto'/, '没有回落到 auto');
});

test('isDark：手动优先，auto 时看系统', () => {
  const m = /export const isDark = computed\(\(\) => \{([\s\S]*?)\n\}\)/.exec(THEME);
  assert.ok(m, '缺 isDark');
  const body = m[1];
  assert.match(body, /=== 'dark'/, '手动深色没有直接返回 true');
  assert.match(body, /=== 'light'/, '手动浅色没有直接返回 false');
  assert.match(body, /prefersDark\.value/, 'auto 时没有看系统设置');
});

test('切换外观时把 data-theme 写到 <html> 上', () => {
  const m = /export function applyAppearance\(\)[\s\S]*?\n}/.exec(THEME);
  assert.ok(m, '缺 applyAppearance');
  const body = m[0];
  assert.match(body, /documentElement/, '没写到根元素');
  // auto 要移除属性，让 CSS 的 media 生效
  assert.match(body, /removeAttribute\('data-theme'\)/, 'auto 时没有移除 data-theme');
  assert.match(body, /setAttribute\('data-theme'/, '手动模式没有设置 data-theme');
});

test('首屏同步应用外观，避免深色用户看到一帧白闪', () => {
  // 配置是异步拉的，等它回来再切换会先闪一下白底。
  // 所以 <head> 里有一段同步脚本先读 localStorage。
  const m = /<script>([\s\S]*?)<\/script><\/head>/.exec(PAGE);
  assert.ok(m, '页面外壳里没有首屏脚本');
  const code = m[1];
  assert.match(code, /localStorage\.getItem\('cloudrive-appearance'\)/, '首屏脚本没读 localStorage');
  assert.match(code, /setAttribute\('data-theme'/, '首屏脚本没设置 data-theme');
  // 必须包在 try 里：隐私模式下 localStorage 访问会抛异常
  assert.match(code, /try\s*\{/, 'localStorage 没包 try');
  // 键名要和 theme.ts 里的一致，否则读了永远为空
  assert.match(THEME, /APPEARANCE_KEY = 'cloudrive-appearance'/, '键名不一致');
});

test('首屏脚本不带内联事件属性（避免之前的转义事故）', () => {
  // v0.5.2 出过内联脚本转义写坏、整段 JS 报废的事故
  const m = /<script>([\s\S]*?)<\/script><\/head>/.exec(PAGE);
  assert.ok(m);
  assert.ok(!/\son\w+=/.test(m[1]), '首屏脚本里有内联事件属性');
});

test('后端会把 appearance 存库并回传', () => {
  const db = read('src/db.ts');
  assert.match(db, /APPEARANCE: 'auto'/, '默认设置里没有 APPEARANCE');
  assert.match(db, /normalizeAppearance/, '缺 normalizeAppearance');
  assert.match(db, /appearance: normalizeAppearance\(pick\('APPEARANCE', 'auto'\)\)/, 'config() 没有返回 appearance');
  assert.match(
    read('src/index.ts'),
    /APPEARANCE: b\.appearance \? db\.normalizeAppearance\(b\.appearance\)/,
    '保存接口没有接收 appearance'
  );
});

test('设置页有外观选项，且改了立刻生效', () => {
  const sp = read('web/src/views/admin/SettingsPanel.vue');
  assert.match(sp, /v-model="cfg\.appearance"/, '外观没有绑定');
  assert.match(sp, /@change="onAppearanceChange"/, '改外观没有即时切换');
  // 即时切换要真的调 setAppearance（不只是标记 dirty）
  assert.match(sp, /setAppearance\(cfg\.appearance\)/, 'onAppearanceChange 没有调用 setAppearance');
  assert.match(sp, /appearance: cfg\.appearance,/, '保存请求没带上 appearance');
  // 三个选项都要在
  for (const label of ['跟随系统', '浅色', '深色']) {
    assert.ok(sp.includes(label) || THEME.includes(label), `缺「${label}」选项`);
  }
});
