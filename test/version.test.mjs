// 版本散落在三个地方，改一处漏两处就会出现「页脚写着旧版本」。
// 这里把三者钉在一起。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function pkgVersion() {
  return JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version;
}
function uiVersion() {
  const src = readFileSync(join(ROOT, 'src', 'ui.js'), 'utf8');
  const m = /export const VERSION\s*=\s*'([^']+)'/.exec(src);
  assert.ok(m, 'src/ui.js 里找不到 VERSION 常量');
  return m[1];
}
function readmeVersion() {
  const src = readFileSync(join(ROOT, 'README.md'), 'utf8');
  const m = /当前版本\s*\*\*v([^*]+)\*\*/.exec(src);
  assert.ok(m, 'README.md 顶部找不到「当前版本」标注');
  return m[1];
}
function changelogLatest() {
  const src = readFileSync(join(ROOT, 'CHANGELOG.md'), 'utf8');
  // 顶层（## 而非 ###）的第一个版本号
  const m = /^##\s+([\w.\-]+)\s+—/m.exec(src);
  assert.ok(m, 'CHANGELOG.md 里找不到顶层版本条目');
  return m[1];
}

test('package.json / ui.js / README / CHANGELOG 版本号一致', () => {
  const pkg = pkgVersion();
  assert.equal(uiVersion(), pkg, `src/ui.js 的 VERSION 是 ${uiVersion()}，package.json 是 ${pkg}`);
  assert.equal(readmeVersion(), pkg, `README 顶部是 ${readmeVersion()}，package.json 是 ${pkg}`);
  assert.equal(changelogLatest(), pkg, `CHANGELOG 最新条目是 ${changelogLatest()}，package.json 是 ${pkg}`);
});

test('当前版本为成品版 1.0.0', () => {
  assert.equal(pkgVersion(), '1.0.0');
});

test('页面渲染出的页脚带版本号', async () => {
  const { adminHtml, loginHtml } = await import('../src/ui.js');
  const v = uiVersion();
  assert.ok(adminHtml({ driver: 'R2', bucket: 'f' }).includes('v' + v), '后台页应显示版本号');
  assert.ok(loginHtml().includes('v' + v), '登录页应显示版本号');
});

// 仓库里应该只剩 1.0.0：文档、源码、脚本里都不该再出现 0.x 的版本痕迹
test('文档与源码里不留旧版本号痕迹', () => {
  const files = [
    'README.md',
    'CHANGELOG.md',
    'package.json',
    'src/index.js',
    'src/ui.js',
    'src/db.js',
    'src/storage.js',
    'src/logo.js',
    'scripts/preset-vars.mjs',
    'scripts/setup-resources.mjs',
    'scripts/ci-secrets.mjs',
  ];
  // 匹配 v0.x / 0.x.y 这类旧版本号；排除 IP 地址（127.0.0.1、0.0.0.0）等非版本用途
  const OLD = /v?0\.\d+\.\d+(?:-[\w.]+)?/g;
  const IP = /^\d+\.\d+\.\d+\.\d+$/;
  for (const f of files) {
    const src = readFileSync(join(ROOT, f), 'utf8');
    const hits = (src.match(OLD) || []).filter((x) => !IP.test(x) && x !== '0.0.0');
    assert.deepEqual(hits, [], `${f} 里还留着旧版本号：${hits.join(', ')}`);
  }
});

test('CHANGELOG 顶层只有 1.0.0 一个版本条目', () => {
  const src = readFileSync(join(ROOT, 'CHANGELOG.md'), 'utf8');
  const top = [...src.matchAll(/^##\s+([\w.\-]+)\s+—/gm)].map((m) => m[1]);
  assert.ok(top.includes('1.0.0'), '顶层应有 1.0.0');
  assert.ok(!top.some((v) => /^0\./.test(v)), `顶层不该有 0.x 条目：${top.join(', ')}`);
});
