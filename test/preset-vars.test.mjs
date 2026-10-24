// 验证「补缺不覆盖」的变量写入逻辑（Worker 已有的变量必须原样保留）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'preset-vars.mjs');

function run(env) {
  const dir = mkdtempSync(join(tmpdir(), 'filecove-vars-'));
  const envFile = join(dir, 'gh-env');
  const outFile = join(dir, 'gh-output');
  writeFileSync(envFile, '');
  writeFileSync(outFile, '');
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [SCRIPT], {
      encoding: 'utf8',
      env: {
        ...process.env,
        PRESET_VARS: '',
        CF_API_BASE: '',
        CLOUDFLARE_API_TOKEN: '',
        CLOUDFLARE_ACCOUNT_ID: '',
        GITHUB_ENV: envFile,
        GITHUB_OUTPUT: outFile,
        ...env,
      },
    });
    let out = '';
    child.stdout.on('data', (c) => (out += c));
    child.stderr.on('data', (c) => (out += c));
    child.on('close', (code) => resolve({ code, out, env: readFileSync(envFile, 'utf8'), gh: readFileSync(outFile, 'utf8') }));
  });
}

// 模拟 Cloudflare 的「读取 Worker 设置」接口，返回已有的文本变量
function mockVars(names, { fail = false } = {}) {
  const server = createServer((req, res) => {
    res.writeHead(fail ? 404 : 200, { 'content-type': 'application/json' });
    res.end(
      JSON.stringify(
        fail
          ? { success: false, errors: [{ code: 1000, message: 'not found' }] }
          : {
              success: true,
              result: {
                bindings: [
                  ...names.map((n) => ({ name: n, text: 'whatever', type: 'plain_text' })),
                  { name: 'ADMIN_PASSWORD', type: 'secret_text' },
                  { name: 'BUCKET', type: 'r2_bucket', bucket_name: 'filecove' },
                ],
              },
            }
      )
    );
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () =>
      resolve({ base: `http://127.0.0.1:${server.address().port}/client/v4`, close: () => server.close() })
    );
  });
}

const parseNames = (txt) => {
  const m = /^names<<(\S+)\n([\s\S]*?)\n\1$/m.exec(txt.trim());
  return m ? m[2].split('\n').filter(Boolean) : [];
};
const parseEnvKeys = (txt) => {
  const out = [];
  const re = /^(\w+)<<(\S+)\n([\s\S]*?)\n\2$/gm;
  let m;
  while ((m = re.exec(txt))) out.push({ key: m[1], value: m[3] });
  return out;
};

// 默认配置由 Worker 写进 D1，Actions 不再往 Worker 铺默认值
test('不配置时不铺任何默认值', async () => {
  const r = await run({ CF_API_BASE: '', CLOUDFLARE_API_TOKEN: '', CLOUDFLARE_ACCOUNT_ID: '' });
  assert.equal(r.code, 0, r.out);
  assert.deepEqual(parseNames(r.gh), []);
  assert.match(r.out, /不铺默认值/);
});

test('即使 Worker 上一个变量都没有也不铺默认值', async (t) => {
  const api = await mockVars([]);
  t.after(api.close);
  const r = await run({ CF_API_BASE: api.base, CLOUDFLARE_API_TOKEN: 'tok', CLOUDFLARE_ACCOUNT_ID: 'acct' });
  assert.equal(r.code, 0, r.out);
  assert.deepEqual(parseNames(r.gh), []);
});

test('Worker 上已有的变量一个都不动', async (t) => {
  const api = await mockVars(['DOWNLOAD_MODE', 'IP_MAX_DOWNLOADS', 'BAN_MINUTES']);
  t.after(api.close);
  const r = await run({
    CF_API_BASE: api.base,
    CLOUDFLARE_API_TOKEN: 'tok',
    CLOUDFLARE_ACCOUNT_ID: 'acct',
  });
  assert.equal(r.code, 0, r.out);
  const keys = parseNames(r.gh);
  assert.ok(!keys.includes('DOWNLOAD_MODE'), '已有值不该被重写');
  assert.ok(!keys.includes('IP_MAX_DOWNLOADS'), '已有值不该被重写');
  assert.ok(!keys.includes('BAN_MINUTES'), '已有值不该被重写');
  assert.deepEqual(keys, [], '未声明时不应写入任何变量');
});

test('PRESET_VARS 显式声明的会写入，即使已有同名变量', async (t) => {
  const api = await mockVars(['DOWNLOAD_MODE']);
  t.after(api.close);
  const r = await run({
    PRESET_VARS: 'DOWNLOAD_MODE=proxy',
    CF_API_BASE: api.base,
    CLOUDFLARE_API_TOKEN: 'tok',
    CLOUDFLARE_ACCOUNT_ID: 'acct',
  });
  assert.equal(r.code, 0, r.out);
  const keys = parseNames(r.gh);
  assert.ok(keys.includes('DOWNLOAD_MODE'), keys.join(','));
  const found = parseEnvKeys(r.env).find((x) => x.key === 'DOWNLOAD_MODE');
  assert.equal(found.value, 'proxy');
  assert.match(r.out, /按 PRESET_VARS 覆盖/);
});

test('变量都在时不写入任何东西', async (t) => {
  const all = ['STORAGE_DRIVER', 'R2_BUCKET_NAME', 'DOWNLOAD_MODE', 'IP_MAX_DOWNLOADS', 'IP_WINDOW_SECONDS', 'BAN_MINUTES', 'MONTHLY_TRAFFIC_LIMIT', 'UPLOAD_MAX_SIZE', 'MULTIPART_THRESHOLD', 'MULTIPART_PART_SIZE', 'TURNSTILE_ENABLED'];
  const api = await mockVars(all);
  t.after(api.close);
  const r = await run({ CF_API_BASE: api.base, CLOUDFLARE_API_TOKEN: 'tok', CLOUDFLARE_ACCOUNT_ID: 'acct' });
  assert.equal(r.code, 0, r.out);
  assert.deepEqual(parseNames(r.gh), []);
  assert.match(r.out, /都已就位/);
});

test('读取失败时按首次部署处理，不中断流程', async (t) => {
  const api = await mockVars([], { fail: true });
  t.after(api.close);
  const r = await run({ CF_API_BASE: api.base, CLOUDFLARE_API_TOKEN: 'tok', CLOUDFLARE_ACCOUNT_ID: 'acct' });
  assert.equal(r.code, 0, r.out);
  assert.equal(r.code, 0, '读取失败不该让流程中断');
});

test('secret / r2 绑定不会被误判为文本变量', async (t) => {
  const api = await mockVars([]);
  t.after(api.close);
  const r = await run({ CF_API_BASE: api.base, CLOUDFLARE_API_TOKEN: 'tok', CLOUDFLARE_ACCOUNT_ID: 'acct' });
  assert.equal(r.code, 0, r.out);
  const keys = parseNames(r.gh);
  assert.ok(!keys.includes('ADMIN_PASSWORD'), '密钥不该出现');
  assert.ok(!keys.includes('BUCKET'), 'R2 绑定不该出现');
});

test('PRESET_VARS 忽略注释与空行，值里的等号不被截断', async () => {
  const r = await run({ PRESET_VARS: '# 注释\n\nPUBLIC_BASE_URL=https://x.example.com/?a=1&b=2' });
  assert.equal(r.code, 0, r.out);
  const found = parseEnvKeys(r.env).find((x) => x.key === 'PUBLIC_BASE_URL');
  assert.equal(found.value, 'https://x.example.com/?a=1&b=2');
});

test('密钥类变量被白名单拦下', async () => {
  const r = await run({ PRESET_VARS: 'ADMIN_PASSWORD=hunter2' });
  assert.notEqual(r.code, 0);
  assert.match(r.out, /白名单/);
});

test('格式错误与非法变量名都明确报错', async () => {
  let r = await run({ PRESET_VARS: 'PUBLIC_BASE_URL' });
  assert.notEqual(r.code, 0);
  assert.match(r.out, /格式不对/);
  r = await run({ PRESET_VARS: 'bad-name=value' });
  assert.notEqual(r.code, 0);
  assert.match(r.out, /变量名不合法/);
});
