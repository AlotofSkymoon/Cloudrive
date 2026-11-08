// Cloudreve / Material Design 视觉风格的检查。
// 演示站 https://demo.cloudreve.org 的登录页是这一版的参照：
// 标题「登录你的账号」、MUI outlined 输入框、contained 主按钮。
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

test('配色是 Cloudreve / Material，不是 iOS 或 M3 旧色板', () => {
  // 默认主色 #3498db 是 Cloudreve 的 --primary
  assert.ok(CSS.includes('--c-tint: 52 152 219'), '浅色 tint 不是 Cloudreve 蓝');
  assert.ok(CSS.includes('--c-tint: 93 173 226'), '深色 tint 不对');
  assert.ok(CSS.includes('--c-red: 244 67 54'), 'MUI error 色不对');
  assert.ok(CSS.includes('--c-green: 76 175 80'), 'MUI success 色不对');
  // 旧的两套色板不该再回来
  for (const old of ['#00639B', '#1976d2', '0 122 255', '10 132 255', '255 59 48', '52 199 89']) {
    assert.ok(!TW.includes(old) && !CSS.includes(old), `还留着旧色值：${old}`);
  }
});

test('字体栈以 Roboto 开头（MUI 默认字体）', () => {
  const m = /sans:\s*\[([\s\S]*?)\]/.exec(TW);
  assert.ok(m, '缺 sans 字体栈');
  assert.match(m[1], /^\s*'Roboto'/, '字体栈应以 Roboto 开头');
  assert.ok(!m[1].includes('SF Pro Text'), '还留着 iOS 的 SF Pro');
});

test('圆角是 MUI 的尺度（统一 8px，抽屉 16px）', () => {
  assert.match(TW, /DEFAULT:\s*'8px'/, '默认圆角应是 8px');
  assert.match(TW, /xl:\s*'16px'/, '抽屉圆角应是 16px');
  assert.ok(!/DEFAULT:\s*'10px'/.test(TW), '还留着 iOS 的 10px 圆角');
});

test('页面切换是从上方顺滑落下（Material 的 fade-through）', () => {
  for (const suf of ['enter-active', 'leave-active', 'enter-from', 'leave-to']) {
    assert.match(CSS, new RegExp(`\\.page-${suf}`), `缺 .page-${suf}`);
  }
  const enter = /\.page-enter-from\s*\{([^}]*)\}/.exec(CSS);
  assert.ok(enter, '缺 .page-enter-from');
  assert.match(enter[1], /translateY\(-/, '新页面不是从上方落下');
  assert.match(enter[1], /opacity:\s*0/, '没有淡入');

  const leave = /\.page-leave-to\s*\{([^}]*)\}/.exec(CSS);
  assert.ok(leave, '缺 .page-leave-to');
  assert.match(leave[1], /translateY\(8px\)/, '旧页面没有向下淡出');
  // iOS 的 push 过渡已经被取代，别再回来
  assert.ok(!CSS.includes('.push-enter-active'), '还留着 SwiftUI 的 push 过渡');
});

test('管理后台用上了 page 过渡和 AppBar', () => {
  const admin = read('web/src/views/AdminView.vue');
  assert.match(admin, /<Transition name="page"/, '主内容切换没用 page');
  assert.match(admin, /class="navbar large[ "]/, '没有 AppBar 容器');
  assert.match(admin, /nav-large-title/, '缺标题');
});

test('AppBar 是不透明纯色 + elevation，不是 iOS 毛玻璃大标题', () => {
  const m = /\.navbar\s*\{([\s\S]*?)\}/.exec(CSS);
  assert.ok(m, '缺 .navbar');
  assert.match(m[1], /min-height:\s*64px/, 'AppBar 高度应是 64px');
  assert.match(m[1], /box-shadow:/, 'AppBar 缺 elevation 阴影');
  assert.ok(!/backdrop-filter/.test(m[1]), 'AppBar 不该有毛玻璃');
  // 标题是 20px medium，不是 34px 粗体
  assert.match(CSS, /\.nav-large-title\s*\{[^}]*font-size:\s*20px/);
  assert.match(CSS, /\.nav-large-title\s*\{[^}]*font-weight:\s*500/);
});

test('输入框是 MUI outlined：1px 描边 + focus 主色描边', () => {
  const m = /\.input\s*\{([\s\S]*?)\}/.exec(CSS);
  assert.ok(m, '缺 .input');
  assert.match(m[1], /border:\s*1px solid/, 'outlined 输入框没有 1px 边框');
  assert.match(m[1], /bg-transparent/, '不该是 iOS 那种灰底填充');
  assert.match(CSS, /\.input:focus\s*\{[^}]*box-shadow:\s*inset/, 'focus 时没有 2px 主色描边');
  // 登录页的浮动 label 压在边框缺口上
  assert.match(CSS, /\.login-field > label/, '缺 MUI 浮动 label');
});

test('侧栏选中项是主色淡底 + 指示条（MUI ListItem），不是 iOS 实心填充', () => {
  assert.match(CSS, /\.nav-item-active\s*\{[^}]*rgb\(var\(--c-tint\) \/ 0\.12\)/, '选中项不是淡底');
  assert.match(CSS, /\.nav-item-active::before/, '缺左侧 3px 指示条');
  assert.ok(!/\.nav-item-active\s*\{[^}]*background:\s*rgb\(var\(--c-tint\) \/ 1\)/.test(CSS), '选中项不该是实心主色块');
});

test('分隔线是 1px（Material divider），不是 iOS 0.5px 发丝线', () => {
  assert.match(CSS, /--hairline:\s*1px/, '分隔线令牌应是 1px');
  assert.ok(!/--hairline:\s*0\.5px/.test(CSS), '还留着 iOS 发丝线');
});

test('登录页对齐 Cloudreve 演示站的结构', () => {
  const login = read('web/src/views/LoginView.vue');
  // 演示站标题就是「登录你的账号 / Sign in to your account」
  assert.match(login, /登录你的账号/, '缺标题「登录你的账号」');
  assert.match(login, /私人网盘登录密码/, '密码框 label 不对');
  assert.match(login, /login-field/, '没用 outlined 浮动 label 输入框');
  assert.match(login, /btn btn-filled/, '主按钮不是 contained 样式');
  assert.match(login, /@submit\.prevent="login"/, '表单提交没有阻止默认行为');
});

test('登录页不放演示站那些假功能按钮', () => {
  // 我们是单管理员密码登录，没有注册 / SSO / QQ / 通行密钥 / 条款页。
  // 抄一排点了没反应的按钮只会误导，所以视觉位置改成说明文字和
  // 一个真实可用的「查看实例状态」链接。
  // 只看模板，不扫注释——注释里会说明「为什么没抄演示站的注册入口」，
  // 那是给人看的，不是界面上的按钮。
  const login = read('web/src/views/LoginView.vue');
  const tpl = (/<template>([\s\S]*)$/.exec(login)?.[1] ?? login)
    .replace(/<!--[\s\S]*?-->/g, ''); // HTML 注释是给开发者看的，不算界面内容
  for (const fake of ['立即注册', '使用 SSO 登录', '使用 QQ 登录', '使用通行密钥器登录', '使用条款', '隐私政策']) {
    assert.ok(!tpl.includes(fake), `登录页出现了假功能：${fake}`);
  }
  assert.match(tpl, /查看实例状态/, '缺真实可用的自检链接');
  assert.match(tpl, /不开放注册/, '没说明这是私人实例');
});

test('视图里没有硬编码的深色文字（深色模式下会看不见）', () => {
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
