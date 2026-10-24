// wrangler.toml 的结构校验。
// 曾在 name 后面插入 [build]，导致 main / compatibility_date 被 TOML 当成
// build 表的字段，部署时报「Missing entry-point to Worker script」。
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'vitest';
import assert from 'node:assert/strict';

const ROOT = join(__dirname, '..');
const raw = readFileSync(join(ROOT, 'wrangler.toml'), 'utf8');

/** 极简解析：区分顶层键、[table] 与 [[array-of-table]] */
function parse(text: string) {
  const top: Record<string, string> = {};
  const tables: Record<string, Record<string, string>> = {};
  let cur = '';
  for (const line of text.split('\n')) {
    const s = line.trim();
    if (!s || s.startsWith('#')) continue;
    const arr = /^\[\[([^\]]+)\]\]$/.exec(s);
    if (arr) {
      cur = arr[1];
      continue;
    }
    const tbl = /^\[([^\]]+)\]$/.exec(s);
    if (tbl) {
      cur = tbl[1];
      tables[cur] = tables[cur] || {};
      continue;
    }
    const kv = /^([A-Za-z_][\w-]*)\s*=\s*(.*)$/.exec(s);
    if (!kv) continue;
    if (cur) (tables[cur] = tables[cur] || {})[kv[1]] = kv[2];
    else top[kv[1]] = kv[2];
  }
  return { top, tables };
}

const { top, tables } = parse(raw);

test('main 与 compatibility_date 是顶层键', () => {
  assert.ok(top.main, '顶层缺 main');
  assert.ok(top.compatibility_date, '顶层缺 compatibility_date');
});

test('入口点指向 src/index.ts', () => {
  assert.equal(top.main.replace(/["']/g, ''), 'src/index.ts');
});

test('入口点不能被 [build] 吞掉', () => {
  const build = tables.build || {};
  assert.equal(build.main, undefined, 'main 出现在了 [build] 表里');
  assert.equal(build.compatibility_date, undefined, 'compatibility_date 出现在了 [build] 表里');
});

test('[build] 有 command，用于部署前构建前端', () => {
  assert.ok((tables.build || {}).command, '[build] 缺 command');
  assert.match((tables.build || {}).command, /npm run build/);
});

test('R2 与 D1 绑定完整', () => {
  const r2 = tables.r2_buckets || {};
  const d1 = tables.d1_databases || {};
  assert.equal(r2.binding, '"BUCKET"');
  assert.equal(d1.binding, '"DB"');
  assert.ok(d1.database_name, 'D1 缺 database_name');
});

test('没有声明 [vars]，避免部署时覆盖控制台变量', () => {
  assert.equal(tables.vars, undefined, 'wrangler.toml 里不该有 [vars]');
});
