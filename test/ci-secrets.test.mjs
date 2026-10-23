// 验证「只上传已配置的密钥」的筛选与输出逻辑
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'ci-secrets.mjs');

function run(env) {
  const dir = mkdtempSync(join(tmpdir(), 'filecove-secrets-'));
  const outFile = join(dir, 'gh-output');
  writeFileSync(outFile, '');
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [SCRIPT], {
      encoding: 'utf8',
      env: { ...process.env, CI_SECRETS_CANDIDATES: '', GITHUB_OUTPUT: outFile, ...env },
    });
    let out = '';
    child.stdout.on('data', (c) => (out += c));
    child.stderr.on('data', (c) => (out += c));
    child.on('close', (code) => resolve({ code, out, gh: readFileSync(outFile, 'utf8') }));
  });
}

// 解析 GITHUB_OUTPUT 里的 names（支持多行 heredoc 语法）
function namesOf(gh) {
  const m = /^names<<(\S+)\n([\s\S]*?)\n\1$/m.exec(gh.trim());
  return m ? m[2].split('\n').map((s) => s.trim()).filter(Boolean) : [];
}

test('只输出已配置值的密钥，未配置的被跳过', async () => {
  const r = await run({ ADMIN_PASSWORD: 'p@ss', TURNSTILE_SECRET: '', S3_ACCESS_KEY_ID: '', S3_SECRET_ACCESS_KEY: '' });
  assert.equal(r.code, 0, r.out);
  assert.deepEqual(namesOf(r.gh), ['ADMIN_PASSWORD']);
  assert.match(r.out, /已跳过：TURNSTILE_SECRET/);
});

test('全部配置时全部输出', async () => {
  const r = await run({
    ADMIN_PASSWORD: 'p@ss',
    TURNSTILE_SECRET: 'sec',
    S3_ACCESS_KEY_ID: 'ak',
    S3_SECRET_ACCESS_KEY: 'sk',
  });
  assert.equal(r.code, 0, r.out);
  assert.deepEqual(namesOf(r.gh), ['ADMIN_PASSWORD', 'TURNSTILE_SECRET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY']);
});

test('缺 ADMIN_PASSWORD 时明确报错退出，且不写入输出', async () => {
  const r = await run({ ADMIN_PASSWORD: '', TURNSTILE_SECRET: 'sec' });
  assert.notEqual(r.code, 0);
  assert.match(r.out, /缺少必需的密钥：ADMIN_PASSWORD/);
  assert.equal(r.gh, '', '失败时不应写入 GITHUB_OUTPUT');
});

test('空格值仍视为已配置（不误判含空格的密码）', async () => {
  const r = await run({ ADMIN_PASSWORD: 'p@ss', TURNSTILE_SECRET: '   ' });
  assert.equal(r.code, 0, r.out);
  // 只有真空字符串才算未配置；全是空格也照样上传，避免误判用户精心设的密码
  assert.deepEqual(namesOf(r.gh), ['ADMIN_PASSWORD', 'TURNSTILE_SECRET']);
});

test('纯空字符串视为未配置', async () => {
  const r = await run({ ADMIN_PASSWORD: 'p@ss', TURNSTILE_SECRET: '' });
  assert.equal(r.code, 0, r.out);
  assert.deepEqual(namesOf(r.gh), ['ADMIN_PASSWORD']);
});

test('输出里绝不出现密钥的值', async () => {
  const r = await run({ ADMIN_PASSWORD: 'super-secret-value', TURNSTILE_SECRET: 'another-secret' });
  assert.ok(!r.out.includes('super-secret-value'), 'stdout 泄漏了密钥值');
  assert.ok(!r.gh.includes('super-secret-value'), 'GITHUB_OUTPUT 泄漏了密钥值');
  assert.ok(!r.gh.includes('another-secret'), 'GITHUB_OUTPUT 泄漏了密钥值');
});

test('可用 CI_SECRETS_CANDIDATES 覆盖候选名单', async () => {
  const r = await run({
    CI_SECRETS_CANDIDATES: 'ADMIN_PASSWORD,MY_OWN_KEY',
    ADMIN_PASSWORD: 'p@ss',
    MY_OWN_KEY: 'v',
    TURNSTILE_SECRET: 'sec',
  });
  assert.equal(r.code, 0, r.out);
  assert.deepEqual(namesOf(r.gh), ['ADMIN_PASSWORD', 'MY_OWN_KEY'], r.gh);
});
