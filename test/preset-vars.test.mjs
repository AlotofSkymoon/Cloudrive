// 验证「可选写入 Worker 变量」的解析逻辑（用临时目录模拟 GITHUB_ENV/OUTPUT）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'preset-vars.mjs');

function run(preset) {
  const dir = mkdtempSync(join(tmpdir(), 'filecove-vars-'));
  const envFile = join(dir, 'gh-env');
  const outFile = join(dir, 'gh-output');
  writeFileSync(envFile, '');
  writeFileSync(outFile, '');
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [SCRIPT], {
      encoding: 'utf8',
      env: { ...process.env, PRESET_VARS: preset ?? '', GITHUB_ENV: envFile, GITHUB_OUTPUT: outFile },
    });
    let out = '';
    child.stdout.on('data', (c) => (out += c));
    child.stderr.on('data', (c) => (out += c));
    child.on('close', (code) =>
      resolve({ code, out, env: readFileSync(envFile, 'utf8'), gh: readFileSync(outFile, 'utf8') })
    );
  });
}

const parseEnv = (txt) => {
  const m = /^(\w+)<<(\S+)\n([\s\S]*?)\n\2$/m.exec(txt.trim());
  return m ? { key: m[1], value: m[3] } : null;
};
const parseNames = (txt) => {
  const m = /^names<<(\S+)\n([\s\S]*?)\n\1$/m.exec(txt.trim());
  return m ? m[2].split('\n').filter(Boolean) : [];
};

test('未配置时不写入任何内容，并说明控制台的值会保留', async () => {
  const r = await run('');
  assert.equal(r.code, 0, r.out);
  assert.equal(r.env, '');
  assert.equal(r.gh, '');
  assert.match(r.out, /完整保留/);
});

test('配置了就写入 GITHUB_ENV 与变量名清单', async () => {
  const r = await run('PUBLIC_BASE_URL=https://cdn.example.com\nDOWNLOAD_MODE=auto');
  assert.equal(r.code, 0, r.out);
  assert.deepEqual(parseNames(r.gh), ['PUBLIC_BASE_URL', 'DOWNLOAD_MODE']);
  assert.match(r.env, /PUBLIC_BASE_URL/);
  assert.match(r.env, /https:\/\/cdn\.example\.com/);
});

test('忽略注释与空行', async () => {
  const r = await run('# 这是注释\n\nPUBLIC_BASE_URL=https://x.example.com\n');
  assert.equal(r.code, 0, r.out);
  assert.deepEqual(parseNames(r.gh), ['PUBLIC_BASE_URL']);
});

test('值里的等号不被截断', async () => {
  const r = await run('PUBLIC_BASE_URL=https://x.example.com/?a=1&b=2');
  assert.equal(r.code, 0, r.out);
  assert.equal(parseEnv(r.env).value, 'https://x.example.com/?a=1&b=2');
});

test('密钥类变量被白名单拦下，避免误写进明文变量', async () => {
  const r = await run('ADMIN_PASSWORD=hunter2');
  assert.notEqual(r.code, 0);
  assert.match(r.out, /白名单/);
  assert.equal(r.gh, '');
});

test('格式错误时明确报错，不静默通过', async () => {
  const r = await run('PUBLIC_BASE_URL');
  assert.notEqual(r.code, 0);
  assert.match(r.out, /格式不对/);
});

test('非法变量名被拒绝', async () => {
  const r = await run('bad-name=value');
  assert.notEqual(r.code, 0);
  assert.match(r.out, /变量名不合法/);
});
