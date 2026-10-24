// 验证「只上传已配置的密钥，且保留 Worker 上已有的值」
import { test, afterEach } from 'vitest';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'ci-secrets.mjs');

function run(env) {
  const dir = mkdtempSync(join(tmpdir(), 'cloudrive-secrets-'));
  const outFile = join(dir, 'gh-output');
  writeFileSync(outFile, '');
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [SCRIPT], {
      encoding: 'utf8',
      env: {
        ...process.env,
        CI_SECRETS_CANDIDATES: '',
        CF_API_BASE: '',
        CLOUDFLARE_API_TOKEN: '',
        CLOUDFLARE_ACCOUNT_ID: '',
        GITHUB_OUTPUT: outFile,
        ...env,
      },
    });
    let out = '';
    child.stdout.on('data', (c) => (out += c));
    child.stderr.on('data', (c) => (out += c));
    child.on('close', (code) => resolve({ code, out, gh: readFileSync(outFile, 'utf8') }));
  });
}

// 本地起服务模拟 Cloudflare 的「列出 Worker 已有密钥」接口
function mockSecretsApi(names, { fail = false } = {}) {
  const server = createServer((req, res) => {
    res.writeHead(fail ? 403 : 200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(fail ? { success: false, errors: [{ code: 1000, message: 'forbidden' }] } : { success: true, result: names.map((n) => ({ name: n, type: 'secret_text' })) }));
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () =>
      resolve({ base: `http://127.0.0.1:${server.address().port}/client/v4`, close: () => server.close() })
    );
  });
}

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

test('GitHub 没配但 Worker 上已有时不报错、不覆盖', async () => {
  const api = await mockSecretsApi(['ADMIN_PASSWORD']);
  afterEach(api.close);
  const r = await run({
    ADMIN_PASSWORD: '',
    CF_API_BASE: api.base,
    CLOUDFLARE_API_TOKEN: 'tok',
    CLOUDFLARE_ACCOUNT_ID: 'acct',
  });
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /不覆盖：ADMIN_PASSWORD/, r.out);
  assert.deepEqual(namesOf(r.gh), [], '已有值不应被重新上传覆盖');
});

test('两边都配了以上传的为准（显式声明优先）', async () => {
  const api = await mockSecretsApi(['ADMIN_PASSWORD']);
  afterEach(api.close);
  const r = await run({
    ADMIN_PASSWORD: 'from-github',
    CF_API_BASE: api.base,
    CLOUDFLARE_API_TOKEN: 'tok',
    CLOUDFLARE_ACCOUNT_ID: 'acct',
  });
  assert.equal(r.code, 0, r.out);
  assert.deepEqual(namesOf(r.gh), ['ADMIN_PASSWORD']);
});

test('查询已有密钥失败时优雅降级为「未配置」', async () => {
  const api = await mockSecretsApi([], { fail: true });
  afterEach(api.close);
  const r = await run({
    ADMIN_PASSWORD: 'p@ss',
    CF_API_BASE: api.base,
    CLOUDFLARE_API_TOKEN: 'tok',
    CLOUDFLARE_ACCOUNT_ID: 'acct',
  });
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /未能读取/);
  assert.deepEqual(namesOf(r.gh), ['ADMIN_PASSWORD']);
});

test('空格值仍视为已配置（不误判含空格的密码）', async () => {
  const r = await run({ ADMIN_PASSWORD: 'p@ss', TURNSTILE_SECRET: '   ' });
  assert.equal(r.code, 0, r.out);
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
