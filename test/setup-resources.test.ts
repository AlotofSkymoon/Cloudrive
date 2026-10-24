// 验证「自动建 D1 并写回 database_id」的脚本逻辑
// 起一个本地 HTTP 服务模拟 Cloudflare API（通过 CF_API_BASE 指过去），全程不联网。
import { test, afterEach } from 'vitest';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = join(root, 'scripts', 'setup-resources.mjs');

const TOML = (id) => `name = "filecove"
main = "src/index.js"

[[r2_buckets]]
binding = "BUCKET"
bucket_name = "filecove"

[[d1_databases]]
binding = "DB"
database_name = "filecove"
database_id = "${id}"
`;

// ---------- 模拟 Cloudflare API ----------
function mockApi(handler) {
  const calls = [];
  const server = createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      const url = new URL(req.url, 'http://127.0.0.1');
      calls.push({ method: req.method, path: url.pathname, query: url.search, body: body ? JSON.parse(body) : null });
      const out = handler({ method: req.method, path: url.pathname, query: url.searchParams, body: body ? JSON.parse(body) : null }) || {};
      res.writeHead(out.status || 200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(out.json ?? {}));
    });
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () =>
      resolve({ calls, base: `http://127.0.0.1:${server.address().port}/client/v4`, close: () => server.close() })
    );
  });
}

const okList = (databases) => ({ json: { success: true, result: databases, result_info: { count: databases.length } } });
const okOne = (result) => ({ json: { success: true, result } });
const errRes = (status, message) => ({ status, json: { success: false, errors: [{ code: 1000, message }] } });

function fakeWrangler(dir, { listOut = '', createOut = '' } = {}) {
  const bin = join(dir, 'fake-wrangler.sh');
  writeFileSync(
    bin,
    `#!/bin/sh
if [ "$2" = "list" ]; then printf '%s' '${listOut}'; exit 0; fi
if [ "$2" = "create" ]; then printf '%s' '${createOut}'; exit 0; fi
exit 0
`
  );
  chmodSync(bin, 0o755);
  return bin;
}

function prepare(id) {
  const dir = mkdtempSync(join(tmpdir(), 'filecove-setup-'));
  mkdirSync(join(dir, 'scripts'), { recursive: true });
  writeFileSync(join(dir, 'scripts', 'setup-resources.mjs'), readFileSync(SCRIPT));
  writeFileSync(join(dir, 'wrangler.toml'), TOML(id));
  return dir;
}

// 注意：必须用异步 spawn。mock 服务跑在本进程，spawnSync 会阻塞事件循环导致请求永远得不到响应。
function run(dir, { base, wranglerBin } = {}) {
  const env = {
    ...process.env,
    CLOUDFLARE_API_TOKEN: 'dummy-token',
    CLOUDFLARE_ACCOUNT_ID: 'acct-0001',
    GITHUB_OUTPUT: '',
    GITHUB_STEP_SUMMARY: '',
  };
  if (base) env.CF_API_BASE = base;
  else delete env.CF_API_BASE;
  if (wranglerBin) env.WRANGLER_CMD = wranglerBin;
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [join(dir, 'scripts', 'setup-resources.mjs')], { cwd: dir, encoding: 'utf8', env });
    let out = '';
    child.stdout.on('data', (c) => (out += c));
    child.stderr.on('data', (c) => (out += c));
    child.on('close', (code) =>
      resolve({ code, out, toml: readFileSync(join(dir, 'wrangler.toml'), 'utf8') })
    );
  });
}

const idOf = (toml) => (/database_id\s*=\s*"([^"]*)"/.exec(toml) || [])[1];
const UUID_A = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const UUID_B = '99999999-8888-7777-6666-555555555555';

test('库已存在时复用，并把 uuid 写回 wrangler.toml', async () => {
  const api = await mockApi(({ method, path, query }) => {
    if (path === '/client/v4/accounts/acct-0001/d1/database' && method === 'GET') {
      return query.get('name') === 'filecove' ? okList([{ name: 'filecove', uuid: UUID_A }]) : okList([]);
    }
    if (path === '/client/v4/accounts/acct-0001/r2/buckets') return okList([]);
    return errRes(404, 'unexpected');
  });
  afterEach(api.close);
  const dir = prepare('待自动填充');
  const r = await run(dir, { base: api.base });
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /复用已有 D1 数据库/);
  assert.equal(idOf(r.toml), UUID_A);
});

test('库不存在时创建，并把新 uuid 写回 wrangler.toml', async () => {
  const api = await mockApi(({ method, path }) => {
    if (path === '/client/v4/accounts/acct-0001/d1/database') {
      return method === 'GET' ? okList([{ name: 'other-db', uuid: '11111111-2222-3333-4444-555555555555' }]) : okOne({ uuid: UUID_B, name: 'filecove' });
    }
    if (path === '/client/v4/accounts/acct-0001/r2/buckets') {
      return method === 'GET' ? okList([]) : okOne({ name: 'filecove' });
    }
    return errRes(404, 'unexpected');
  });
  afterEach(api.close);
  const dir = prepare('待自动填充');
  const r = await run(dir, { base: api.base });
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /已创建 D1 数据库/);
  assert.equal(idOf(r.toml), UUID_B);
  assert.ok(api.calls.some((c) => c.method === 'POST' && c.path.endsWith('/d1/database')));
});

test('database_id 已是合法 UUID 时原样保留，且不碰 D1 接口', async () => {
  const api = await mockApi(({ path }) => {
    if (path.includes('/d1/')) return errRes(500, 'D1 接口不应被调用');
    if (path.endsWith('/r2/buckets')) return { json: { success: true, result: { buckets: [{ name: 'filecove' }] } } };
    return errRes(404, 'unexpected');
  });
  afterEach(api.close);
  const dir = prepare(UUID_A);
  const r = await run(dir, { base: api.base });
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /跳过创建/);
  assert.equal(idOf(r.toml), UUID_A);
  assert.ok(!api.calls.some((c) => c.path.includes('/d1/')), '不应调用 D1 接口');
});

test('创建时返回"已存在"则转为复用，不会失败', async () => {
  let listed = 0;
  const api = await mockApi(({ method, path }) => {
    if (path.endsWith('/d1/database')) {
      if (method === 'GET') {
        // 前两次查询查不到（模拟并发下刚被别人建好），之后能查到
        listed++;
        return listed <= 2 ? okList([]) : okList([{ name: 'filecove', uuid: UUID_A }]);
      }
      return errRes(409, 'database already exists');
    }
    if (path.endsWith('/r2/buckets')) return okList([]);
    return errRes(404, 'unexpected');
  });
  afterEach(api.close);
  const dir = prepare('待自动填充');
  const r = await run(dir, { base: api.base });
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /复用已有 D1 数据库/);
  assert.equal(idOf(r.toml), UUID_A);
});

test('R2 桶已存在时跳过创建', async () => {
  const api = await mockApi(({ method, path }) => {
    if (path.endsWith('/d1/database')) return method === 'GET' ? okList([{ name: 'filecove', uuid: UUID_A }]) : okOne({ uuid: UUID_A });
    if (path.endsWith('/r2/buckets')) return method === 'GET' ? { json: { success: true, result: { buckets: [{ name: 'filecove' }] } } } : errRes(500, 'should not create');
    return errRes(404, 'unexpected');
  });
  afterEach(api.close);
  const dir = prepare(UUID_A);
  const r = await run(dir, { base: api.base });
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /复用已有 R2 存储桶/);
  assert.ok(!api.calls.some((c) => c.method === 'POST' && c.path.endsWith('/r2/buckets')));
});

test('API 鉴权失败时回退 wrangler，仍能拿到 uuid', async () => {
  const api = await mockApi(() => errRes(401, 'Invalid API token'));
  afterEach(api.close);
  const dir = prepare('待自动填充');
  const bin = fakeWrangler(dir, {
    listOut: '',
    createOut: '✅ Successfully created DB filecove\\n\\n[[d1_databases]]\\nbinding = \"DB\"\\ndatabase_name = \"filecove\"\\ndatabase_id = \"' + UUID_B + '\"',
  });
  const r = await run(dir, { base: api.base, wranglerBin: bin });
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /回退到 wrangler CLI/);
  assert.equal(idOf(r.toml), UUID_B);
});

test('API 与 wrangler 都失败时明确报错退出', async () => {
  const api = await mockApi(() => errRes(403, 'insufficient permissions'));
  afterEach(api.close);
  const dir = prepare('待自动填充');
  const bin = fakeWrangler(dir, { listOut: '', createOut: 'Error: no permission' });
  const r = await run(dir, { base: api.base, wranglerBin: bin });
  assert.notEqual(r.code, 0);
  assert.match(r.out, /创建 D1 数据库失败/);
  assert.equal(idOf(r.toml), '待自动填充', '失败时不应改动 wrangler.toml');
});

test('缺少 Cloudflare 凭据时明确失败', () => {
  const dir = prepare('待自动填充');
  const res = spawnSync(process.execPath, [join(dir, 'scripts', 'setup-resources.mjs')], {
    cwd: dir,
    encoding: 'utf8',
    env: { ...process.env, CLOUDFLARE_API_TOKEN: '', CLOUDFLARE_ACCOUNT_ID: '' },
  });
  assert.notEqual(res.status, 0);
  assert.match(`${res.stdout}${res.stderr}`, /CLOUDFLARE_API_TOKEN/);
});
