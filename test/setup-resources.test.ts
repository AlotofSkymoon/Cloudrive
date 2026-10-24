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

const TOML = (id) => `name = "cloudrive"
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
  const dir = mkdtempSync(join(tmpdir(), 'cloudrive-setup-'));
  mkdirSync(join(dir, 'scripts'), { recursive: true });
  writeFileSync(join(dir, 'scripts', 'setup-resources.mjs'), readFileSync(SCRIPT));
  writeFileSync(join(dir, 'wrangler.toml'), TOML(id));
  return dir;
}

/** 仓库里 wrangler.toml 的默认名是 cloudrive（迁移测试用这个） */
const TOML_NEW = (id) => `name = "cloudrive"
main = "src/index.ts"

[[r2_buckets]]
binding = "BUCKET"
bucket_name = "cloudrive"

[[d1_databases]]
binding = "DB"
database_name = "cloudrive"
database_id = "${id}"
`;

function prepareNew(id) {
  const dir = prepare(id);
  writeFileSync(join(dir, 'wrangler.toml'), TOML_NEW(id));
  return dir;
}

/** 带自定义环境变量运行 */
function runWith(dir, extraEnv) {
  const env = {
    ...process.env,
    CLOUDFLARE_API_TOKEN: 'dummy-token',
    CLOUDFLARE_ACCOUNT_ID: 'acct-0001',
    GITHUB_OUTPUT: '',
    GITHUB_STEP_SUMMARY: '',
    ...extraEnv,
  };
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [join(dir, 'scripts', 'setup-resources.mjs')], {
      cwd: dir,
      encoding: 'utf8',
      env,
    });
    let out = '';
    child.stdout.on('data', (c) => (out += c));
    child.stderr.on('data', (c) => (out += c));
    child.on('close', (code) =>
      resolve({ code, out, toml: readFileSync(join(dir, 'wrangler.toml'), 'utf8') })
    );
  });
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

/* ---------- 资源名迁移：老用户复用 filecove，新用户建 cloudrive ---------- */

test('老用户：有 filecove 就复用，不建 cloudrive，并把名字写回', async () => {
  const api = await mockApi(({ method, path, query }) => {
    // D1：cloudrive 查不到，filecove 查得到
    if (path.endsWith('/d1/database')) {
      const name = query.get('name');
      if (method === 'GET') {
        return name === 'filecove' ? okList([{ name: 'filecove', uuid: UUID_A }]) : okList([]);
      }
      throw new Error('不应创建任何 D1 库');
    }
    // R2：只有 filecove
    if (path.endsWith('/r2/buckets')) {
      return { json: { success: true, result: { buckets: [{ name: 'filecove' }] } } };
    }
    return {};
  });
  afterEach(api.close);
  const dir = prepareNew('待自动填充');
  const r = await run(dir, { base: api.base });

  assert.equal(r.code, 0);
  assert.match(r.out, /复用已有 D1 数据库 filecove/, '没有复用旧库');
  assert.match(r.out, /旧项目留下的库/, '没有提示这是旧库');
  assert.match(r.out, /复用已有 R2 存储桶 filecove/, '没有复用旧桶');
  // 关键：绝不能创建 cloudrive
  const created = api.calls.filter((c) => c.method === 'POST');
  assert.equal(created.length, 0, `不应该创建任何资源，实际创建了 ${JSON.stringify(created)}`);
  // 实际用到的名字要写回 toml，下次不用再探测
  assert.match(r.toml, /database_name\s*=\s*"filecove"/, 'database_name 没写回');
  assert.match(r.toml, /bucket_name\s*=\s*"filecove"/, 'bucket_name 没写回');
  assert.equal(idOf(r.toml), UUID_A);
});

test('新用户：都没有时创建 cloudrive', async () => {
  const api = await mockApi(({ method, path, body }) => {
    if (path.endsWith('/d1/database')) {
      return method === 'GET' ? okList([]) : okOne({ uuid: UUID_B, name: body.name });
    }
    if (path.endsWith('/r2/buckets')) {
      return method === 'GET' ? { json: { success: true, result: { buckets: [] } } } : okOne({ name: body.name });
    }
    return {};
  });
  afterEach(api.close);
  const dir = prepareNew('待自动填充');
  const r = await run(dir, { base: api.base });

  assert.equal(r.code, 0);
  assert.match(r.out, /创建 D1 数据库：cloudrive/);
  assert.match(r.out, /R2 存储桶 cloudrive 已创建/);
  // 两个 POST 都是 cloudrive
  const names = api.calls.filter((c) => c.method === 'POST').map((c) => c.body?.name);
  assert.deepEqual(names, ['cloudrive', 'cloudrive'], `创建的名字不对：${JSON.stringify(names)}`);
  assert.match(r.toml, /database_name\s*=\s*"cloudrive"/);
  assert.match(r.toml, /bucket_name\s*=\s*"cloudrive"/);
});

test('两个都存在时优先用 cloudrive（新名优先）', async () => {
  const api = await mockApi(({ method, path, body }) => {
    if (path.endsWith('/d1/database')) {
      if (method === 'GET') {
        const name = new URLSearchParams(path).get('name');
        const q = path.includes('?') ? path.slice(path.indexOf('?')) : '';
        void name; void q;
        return okList([
          { name: 'cloudrive', uuid: UUID_B },
          { name: 'filecove', uuid: UUID_A },
        ]);
      }
      throw new Error('不应创建');
    }
    if (path.endsWith('/r2/buckets')) {
      return { json: { success: true, result: { buckets: [{ name: 'cloudrive' }, { name: 'filecove' }] } } };
    }
    return {};
  });
  afterEach(api.close);
  const dir = prepareNew('待自动填充');
  const r = await run(dir, { base: api.base });

  assert.equal(r.code, 0);
  assert.match(r.out, /复用已有 D1 数据库 cloudrive/, '没有优先用新名');
  assert.match(r.out, /复用已有 R2 存储桶 cloudrive/);
  assert.equal(idOf(r.toml), UUID_B, '用的是旧库的 uuid');
  assert.equal(api.calls.filter((c) => c.method === 'POST').length, 0, '不应创建任何资源');
});

test('R2 桶列表分页时也能找到（不会漏判成不存在）', async () => {
  let page = 0;
  const api = await mockApi(({ method, path }) => {
    if (path.endsWith('/d1/database')) {
      return method === 'GET' ? okList([{ name: 'filecove', uuid: UUID_A }]) : okOne({ uuid: UUID_A });
    }
    if (path.endsWith('/r2/buckets')) {
      if (method === 'GET') {
        page++;
        // 第一页只有别的桶 + 游标，第二页才是 filecove
        if (page === 1) {
          return { json: { success: true, result: { buckets: [{ name: 'other' }] }, result_info: { cursor: 'page2' } } };
        }
        return { json: { success: true, result: { buckets: [{ name: 'filecove' }] } } };
      }
      throw new Error('不应创建桶——分页没翻完就误判成不存在了');
    }
    return {};
  });
  afterEach(api.close);
  const dir = prepareNew('待自动填充');
  const r = await run(dir, { base: api.base });

  assert.equal(r.code, 0);
  assert.match(r.out, /复用已有 R2 存储桶 filecove/, '分页第二页的桶没被找到');
  assert.equal(api.calls.filter((c) => c.method === 'POST' && c.path.endsWith('/r2/buckets')).length, 0);
});

test('显式指定名字时不走迁移探测', async () => {
  const api = await mockApi(({ method, path, body }) => {
    if (path.endsWith('/d1/database')) {
      return method === 'GET' ? okList([]) : okOne({ uuid: UUID_B, name: body.name });
    }
    if (path.endsWith('/r2/buckets')) {
      return method === 'GET' ? { json: { success: true, result: { buckets: [] } } } : okOne({ name: body.name });
    }
    return {};
  });
  afterEach(api.close);
  const dir = prepareNew('待自动填充');
  const r = await runWith(dir, {
    CF_API_BASE: api.base,
    D1_DATABASE_NAME: 'my-db',
    R2_BUCKET_NAME: 'my-bucket',
  });

  assert.equal(r.code, 0);
  assert.match(r.out, /创建 D1 数据库：my-db/);
  assert.match(r.out, /R2 存储桶 my-bucket 已创建/);
  // 显式指定后不该再去查 filecove / cloudrive
  const queried = api.calls
    .filter((c) => c.method === 'GET' && c.path.endsWith('/d1/database'))
    .map((c) => c.query || '');
  assert.equal(
    queried.some((q) => q.includes('filecove') || q.includes('cloudrive')),
    false,
    `显式指定时不该再探测默认名，实际查了：${JSON.stringify(queried)}`
  );
});
