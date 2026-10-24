// SwiftUI / iOS 视觉风格的检查。
// 设计令牌集中在 web/src/style.css 的 :root（浅色 + 深色两套）与
// tailwind.config.js 里，这里钉住它们的一致性，避免改了一个忘另一个。
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'vitest';
import assert from 'node:assert/strict';

const ROOT = join(__dirname, '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

const CSS = read('web/src/style.css');
const TW = read('tailwind.config.js');

/** 浅色令牌（第一个 :root 块） */
function lightTokens(): string[] {
  const b = /\n:root \{([\s\S]*?)\n\}/.exec(CSS);
  assert.ok(b, '缺浅色 :root 块');
  return [...b[1].matchAll(/--([a-z0-9-]+):/g)].map((m) => m[1]);
}

/** 深色令牌在 CSS 里出现两次：media 内一份、[data-theme='dark'] 一份 */
function darkBlocks(): string[] {
  const media = /@media \(prefers-color-scheme: dark\) \{\s*:root:not\(\[data-theme='light'\]\) \{([\s\S]*?)\n  \}\n\}/.exec(CSS);
  const attr = /:root\[data-theme='dark'\] \{([\s\S]*?)\n\}/.exec(CSS);
  assert.ok(media, '缺跟随系统的深色块');
  assert.ok(attr, `缺 [data-theme='dark'] 深色块`);
  return [media[1], attr[1]];
}

test('浅色与深色两套令牌的变量名完全对称', () => {
  const light = new Set(lightTokens());
  for (const [i, block] of darkBlocks().entries()) {
    const dark = new Set([...block.matchAll(/--([a-z0-9-]+):/g)].map((m) => m[1]));
    // 深色漏定义某个变量时会静默继承浅色值——不报错，只是配色错乱
    const missing = [...light].filter((x) => !dark.has(x));
    assert.deepEqual(missing, [], `第 ${i + 1} 份深色块缺少：${missing.join(', ')}`);
  }
});

test('所有被引用的 CSS 变量都有定义', () => {
  // tailwind.config.js 用 rgb(var(--x) / <alpha-value>)，style.css 直接用 var(--x)
  // 变量名写错不会报错，只会变成无效颜色，所以必须静态钉住
  const used = new Set([
    ...[...TW.matchAll(/var\(--([a-z0-9-]+)\)/g)].map((m) => m[1]),
    ...[...CSS.matchAll(/var\(--([a-z0-9-]+)\)/g)].map((m) => m[1]),
  ]);
  // 'x' 来自注释里的写法示例 rgb(var(--x) / <alpha-value>)，不是真引用
  used.delete('x');
  const defined = new Set(lightTokens());
  const missing = [...used].filter((v) => !defined.has(v));
  assert.deepEqual(missing, [], `引用了未定义的变量：${missing.join(', ')}`);
});

test('用的是 iOS 系统色，不是 Material 3 的色板', () => {
  // M3 主色（蓝灰）不该再出现
  assert.ok(!TW.includes('#00639B'), '还留着 M3 的 primary');
  assert.ok(!TW.includes('#1976d2'), '还留着 M2 的蓝色');
  // iOS systemBlue
  assert.ok(CSS.includes('--c-tint: 0 122 255'), '浅色的 tint 不是 iOS systemBlue');
  assert.ok(CSS.includes('--c-tint: 10 132 255'), '深色的 tint 不是 iOS systemBlue(dark)');
  // iOS systemRed / systemGreen
  assert.ok(CSS.includes('--c-red: 255 59 48'), 'systemRed 不对');
  assert.ok(CSS.includes('--c-green: 52 199 89'), 'systemGreen 不对');
});

test('字体栈以 SF Pro / 系统字体开头，不再优先 Roboto', () => {
  // Roboto 是 Material 的默认字体，在 iOS 上会破坏观感
  assert.ok(!TW.includes('Roboto'), '字体栈里还有 Roboto');
  assert.match(TW, /'-apple-system'/, '字体栈应以 -apple-system 开头');
  assert.match(TW, /SF Pro Text/, '应包含 SF Pro Text');
});

test('圆角是 iOS 的尺度（卡片 10px，不是 M3 的胶囊）', () => {
  // M3 按钮是全圆角（9999px）；iOS 按钮是 10px 圆角矩形
  assert.match(TW, /DEFAULT:\s*'10px'/, '默认圆角应是 10px');
  assert.match(TW, /xl:\s*'22px'/, '抽屉圆角应是 22px（iOS sheet）');
});

test('push 过渡存在：新页从右推入，旧页视差左移', () => {
  // 这是 SwiftUI NavigationStack 的标志性动画
  for (const suf of ['enter-active', 'leave-active', 'enter-from', 'leave-to']) {
    assert.match(CSS, new RegExp(`\\.push-${suf}`), `缺 .push-${suf}`);
  }
  const enter = /\.push-enter-from\s*\{([^}]*)\}/.exec(CSS);
  assert.ok(enter, '缺 .push-enter-from');
  assert.match(enter[1], /translateX\(100%\)/, '新页面不是从右侧推入');

  const leave = /\.push-leave-to\s*\{([^}]*)\}/.exec(CSS);
  assert.ok(leave, '缺 .push-leave-to');
  assert.match(leave[1], /translateX\(-/, '旧页面没有视差左移');
});

test('管理后台确实用上了 push 和大标题导航栏', () => {
  const admin = read('web/src/views/AdminView.vue');
  assert.match(admin, /<Transition name="push"/, '主内容切换没用 push');
  // 实际写法是 class="navbar large pt-safe"，只匹配前两个类名
  assert.match(admin, /class="navbar large[ "]/, '没有用 iOS 大标题导航栏');
  assert.match(admin, /nav-large-title/, '缺大标题');
});

test('导航栏有毛玻璃，符合 SwiftUI 的 navigationBar 观感', () => {
  const m = /\.navbar\s*\{([\s\S]*?)\}/.exec(CSS);
  assert.ok(m, '缺 .navbar');
  assert.match(m[1], /backdrop-filter:\s*saturate\(180%\)\s*blur\(20px\)/, '导航栏没有毛玻璃');
  // nav-actions 是绝对定位的，navbar 必须提供定位上下文
  assert.match(m[1], /position:\s*relative/, 'navbar 缺 position: relative，绝对定位的子元素会跑飞');
});

test('分隔线用 0.5px 发丝线（iOS separator）', () => {
  assert.match(CSS, /--hairline:\s*0\.5px/, '缺 0.5px 发丝线令牌');
  assert.ok(CSS.includes('var(--hairline)'), '没有实际使用发丝线');
});

test('视图里没有硬编码的深色文字（深色模式下会看不见）', () => {
  // 之前 btn-tonal / chip 用了 #0C1C22 这类深色，深色模式下深底深字
  const BAD = ['001f2c', '0c1c22', '410002', '1a1c1e'];
  for (const f of [
    'web/src/views/AdminView.vue',
    'web/src/views/LoginView.vue',
    'web/src/views/ShareView.vue',
    'web/src/views/ErrorView.vue',
    'web/src/views/admin/FilesPanel.vue',
    'web/src/views/admin/SettingsPanel.vue',
    'web/src/views/admin/DetailPanel.vue',
  ]) {
    const src = read(f);
    for (const m of src.matchAll(/text-\[#([0-9A-Fa-f]{3,8})\]/g)) {
      assert.ok(!BAD.includes(m[1].toLowerCase()), `${f} 还有硬编码深色文字 ${m[0]}`);
    }
  }
});
