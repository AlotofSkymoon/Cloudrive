// 动效检查：所有页面切换 / 弹窗 / 抽屉都要有过渡，且尊重「减弱动态效果」。
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'vitest';
import assert from 'node:assert/strict';

const ROOT = join(__dirname, '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

const CSS = read('web/src/style.css');

test('定义了四类过渡：页面切换 / 弹窗 zoom / 抽屉 / 淡入', () => {
  // Vue 的 <Transition name="x"> 需要有对应的 .x-enter-active 等类
  for (const name of ['view', 'zoom', 'sheet', 'fade']) {
    assert.match(CSS, new RegExp(`\\.${name}-enter-active`), `缺 .${name}-enter-active`);
    assert.match(CSS, new RegExp(`\\.${name}-leave-active`), `缺 .${name}-leave-active`);
    assert.match(CSS, new RegExp(`\\.${name}-enter-from`), `缺 .${name}-enter-from`);
    assert.match(CSS, new RegExp(`\\.${name}-leave-to`), `缺 .${name}-leave-to`);
  }
});

test('页面切换是从上方顺滑落下（不是硬切）', () => {
  const m = /\.view-enter-from\s*\{([^}]*)\}/.exec(CSS);
  assert.ok(m, '缺 .view-enter-from');
  // 负 translateY = 从上方进入
  assert.match(m[1], /translateY\(-/ , '新页面不是从上方落下');
  assert.match(m[1], /opacity:\s*0/, '没有淡入');
});

test('弹窗是 zoom in（缩放 + 淡入，带轻微回弹）', () => {
  const m = /\.zoom-enter-from,\s*\.zoom-leave-to\s*\{([^}]*)\}/.exec(CSS);
  assert.ok(m, '缺 zoom 的起止状态');
  assert.match(m[1], /scale\(/, '弹窗没有缩放效果');
  assert.match(m[1], /opacity:\s*0/, '弹窗没有淡入');
  // 回弹曲线：cubic-bezier 的控制点超出 1
  assert.match(CSS, /\.zoom-enter-active[\s\S]*?cubic-bezier\([^)]*1\.\d+/, '没有回弹手感');
});

test('抽屉 / 上传面板从下方滑入', () => {
  const m = /\.sheet-enter-from,\s*\.sheet-leave-to\s*\{([^}]*)\}/.exec(CSS);
  assert.ok(m, '缺 sheet 的起止状态');
  assert.match(m[1], /translateY\(100%\)/, '抽屉不是从下方滑入');
});

test('常规交互元素也有过渡（按钮 / 卡片 / 输入框）', () => {
  for (const sel of ['.btn', '.card', '.nav-item', '.input']) {
    const re = new RegExp(`\\${sel}[^{]*\\{[^}]*transition:`);
    assert.match(CSS, re, `${sel} 没有 transition`);
  }
  // 按下有反馈
  assert.match(CSS, /\.btn:active[^{]*\{[^}]*transform:\s*scale\(/, '按钮按下没有缩放反馈');
});

test('尊重系统的「减弱动态效果」设置', () => {
  // 不加这条，前庭功能敏感的用户会不适
  assert.match(CSS, /@media\s*\(prefers-reduced-motion:\s*reduce\)/, '缺 prefers-reduced-motion 兜底');
  // 只匹配到行首的 } —— 块内嵌套规则的 } 都带缩进，不会被提前截断
  const m = /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{([\s\S]*?)\n\}/.exec(CSS);
  assert.ok(m, '减弱动态效果的块没闭合或没内容');
  assert.match(m[1], /animation-duration:\s*0\.01ms\s*!important/, '没有关掉动画');
  assert.match(m[1], /transition-duration:\s*0\.01ms\s*!important/, '没有关掉过渡');
});

test('组件里确实用上了这些过渡', () => {
  // 视图切换
  const admin = read('web/src/views/AdminView.vue');
  assert.match(admin, /<Transition name="view"/, '管理后台没有页面切换过渡');
  assert.match(admin, /mode="out-in"/, '切换没用 out-in，会两个页面重叠跳动');
  assert.match(admin, /:key="active"/, '没有 key，切换时不会触发过渡');

  // 弹窗 / 灯箱 / 上传面板
  const files = read('web/src/views/admin/FilesPanel.vue');
  assert.match(files, /<Transition name="fade">/, '分享弹窗没有过渡');
  assert.match(files, /<Transition name="sheet">/, '上传面板没有过渡');
  assert.match(files, /zoom-in/, '弹窗内容没有 zoom in');

  // 分享页灯箱
  assert.match(read('web/src/views/ShareView.vue'), /<Transition name="fade">/, '分享页灯箱没有过渡');
});

test('进度条宽度变化是平滑的，且没有用宽选择器误伤其它元素', () => {
  // 之前写过 [class*='rounded-full']，会命中导航条目、抽屉把手并覆盖它们自己的过渡
  assert.ok(!/\[class\*='rounded-full'\]\s*\{[^}]*transition:\s*width/.test(CSS), '不该用宽选择器');
  assert.match(CSS, /\.bar-fill\s*\{[^}]*transition:\s*width/, '缺 .bar-fill 的宽度过渡');
});
