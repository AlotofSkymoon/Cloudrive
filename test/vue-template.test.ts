// Vue 模板的结构检查。
// 起因：v1.8.x 往模板里插 <Transition> 和改断点类名时，用字符串替换改坏了
// 多行起始标签——把 `>` 弄丢了，或者把 <Transition> 插进了另一个标签的
// 属性列表中间。本地装不上依赖跑不了 vue 编译器，所以用静态检查兜住：
//   - 起始标签的属性列表必须以 > 或 /> 结束
//   - 标签开闭必须平衡
//   - <Transition> 后面不能直接跟裸属性
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readdirSync } from 'node:fs';
import { test } from 'vitest';
import assert from 'node:assert/strict';

const ROOT = join(__dirname, '..');

function vueFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.vue')) out.push(p);
    }
  };
  walk(join(ROOT, 'web/src'));
  return out.map((p) => p.slice(ROOT.length + 1));
}

const VOID = new Set([
  'br', 'hr', 'img', 'input', 'meta', 'link', 'source',
  'area', 'base', 'col', 'embed', 'param', 'track', 'wbr',
]);

/** 取出 <template> 区块（贪婪匹配到最后一个 </template>） */
function templateOf(src: string): string {
  const m = /<template>([\s\S]*)\n<\/template>/.exec(src);
  return m ? m[1] : src;
}

/** 去掉注释和字符串字面量，避免里面的 < > 干扰解析 */
function strip(src: string): string {
  return src
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/"[^"]*"/g, '""')
    .replace(/'[^']*'/g, "''")
    .replace(/<\/?template[^>]*>/g, '');
}

test('起始标签的属性列表都有 > 收尾', () => {
  // v1.8.0 改断点类名时把 11 处 `>` 弄丢了，vite 报
  // "Duplicate attribute"（相邻标签被当成上一个标签的属性）
  for (const f of vueFiles()) {
    const lines = readFileSync(join(ROOT, f), 'utf8').split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].replace(/\s+$/, '');
      if (!/^\s*<[a-zA-Z][\w-]*\s+[^>]*=\s*"[^"]*"\s*$/.test(line)) continue;
      if (line.trimEnd().endsWith('>')) continue;
      // 下一行若是属性或独立的 > 则合法（多行写法）
      let next = '';
      for (let j = i + 1; j < Math.min(i + 3, lines.length); j++) {
        if (lines[j].trim()) {
          next = lines[j].trim();
          break;
        }
      }
      const ok = /^[:\w@.\-]+\s*=/.test(next) || next.startsWith('>') || next.startsWith('/>');
      assert.ok(ok, `${f}:${i + 1} 起始标签没闭合：${line.trim().slice(0, 80)}`);
    }
  }
});

test('模板标签开闭平衡', () => {
  for (const f of vueFiles()) {
    const t = strip(templateOf(readFileSync(join(ROOT, f), 'utf8')));
    const stack: string[] = [];
    const re = /<(\/?)([a-zA-Z][\w.\-]*)([^>]*?)(\/?)>/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(t))) {
      const [, close, name, , selfClose] = m;
      if (close) {
        assert.ok(stack.length, `${f} 有多余的 </${name}>`);
        assert.equal(stack[stack.length - 1], name, `${f} 期望 </${stack[stack.length - 1]}> 但遇到 </${name}>`);
        stack.pop();
      } else if (!selfClose && !VOID.has(name)) {
        stack.push(name);
      }
    }
    assert.deepEqual(stack, [], `${f} 有未闭合标签：${stack.join(', ')}`);
  }
});

test('<Transition> 后面不能直接跟裸属性', () => {
  // v1.8.0 插 <Transition> 时把它塞进了 <div> 的属性列表中间，
  // 结果 <div 的属性被拆散、Transition 反而没了子元素
  const ATTR = /^(v-|:|@|[a-z-]+\s*=)/;
  for (const f of vueFiles()) {
    const lines = readFileSync(join(ROOT, f), 'utf8').split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (!/^\s*<Transition\b/.test(lines[i])) continue;
      assert.ok(/>\s*$/.test(lines[i]), `${f}:${i + 1} <Transition> 自身没闭合`);
      for (let j = i + 1; j < lines.length; j++) {
        if (!lines[j].trim()) continue;
        assert.ok(
          !ATTR.test(lines[j].trim()),
          `${f}:${j + 1} <Transition> 后面是裸属性「${lines[j].trim().slice(0, 40)}」——它被插进了别的标签里面`
        );
        break;
      }
    }
  }
});

test('模板里没有相邻两个未闭合的起始标签', () => {
  // 直接复现 v1.8.0 的报错：两个 <div ... 连续出现且都没 >
  for (const f of vueFiles()) {
    const lines = readFileSync(join(ROOT, f), 'utf8').split('\n');
    let prevOpen = false;
    for (const l of lines) {
      const s = l.trim();
      const isOpen = /^<[a-zA-Z][\w-]*\s/.test(s) && !/>\s*$/.test(s) && !/\/>\s*$/.test(s);
      assert.ok(!(prevOpen && isOpen), `${f} 出现连续两个未闭合起始标签：${s.slice(0, 60)}`);
      prevOpen = isOpen;
    }
  }
});
