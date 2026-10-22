// 验证「自动建 D1 并写回 database_id」的脚本逻辑（用伪造的 wrangler 命令，不联网）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = join(root, 'scripts', 'setup-resources.mjs');
const TOML_TEMPLATE = `name = "filecove"
main = "src/index.js"

[[r2_buckets]]
binding = "BUCKET"
bucket_name = "filecove"

[[d1_databases]]
binding = "DB"
database_name = "filecove"
database_id = "__PLACEHOLDER__"
`;

// 伪造的 wrangler：按参数返回固定 JSON
function fakeWrangler(dir, { existing = [], created = null } = {}) {
  const bin = join(dir, 'fake-wrangler.sh');
  const payload = JSON.stringify(existing);
  const createdPayload = JSON.stringify(created);
  writeFileSync(
    bin,
    `#!/bin/sh
if [ "$2" = "list" ]; then
  echo '${payload}'
  exit 0
fi
if [ "$2" = "create" ]; then
  echo '${createdPayload}'
  exit 0
fi
if [ "$2" = "bucket" ]; then
  echo "Creating bucket $4"
  exit 0
fi
exit 0
`
  );
  chmodSync(bin, 0o755);
  return bin;
}

function prepare(toml) {
  const dir = mkdtempSync(join(tmpdir(), 'filecove-setup-'));
  mkdirSync(join(dir, 'scripts'), { recursive: true });
  writeFileSync(join(dir, 'scripts', 'setup-resources.mjs'), readFileSync(SCRIPT));
  writeFileSync(join(dir, 'wrangler.toml'), toml);
  return dir;
}

function run(dir, bin) {
  const res = spawnSync(process.execPath, [join(dir, 'scripts', 'setup-resources.mjs')], {
    cwd: dir,
    encoding: 'utf8',
    env: {
      ...process.env,
      WRANGLER_CMD: bin,
      CLOUDFLARE_API_TOKEN: 'dummy-token',
      CLOUDFLARE_ACCOUNT_ID: 'dummy-account',
      GITHUB_OUTPUT: '',
      GITHUB_STEP_SUMMARY: '',
    },
  });
  return {
    code: res.status,
    out: `${res.stdout || ''}${res.stderr || ''}`,
    toml: readFileSync(join(dir, 'wrangler.toml'), 'utf8'),
  };
}

const idOf = (toml) => (/database_id\s*=\s*"([^"]*)"/.exec(toml) || [])[1];

test('库已存在时复用，并把 id 写回 wrangler.toml', () => {
  const dir = prepare(TOML_TEMPLATE.replace('__PLACEHOLDER__', '在这里填写你的 D1 database_id'));
  const bin = fakeWrangler(dir, { existing: [{ name: 'filecove', uuid: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' }] });
  const r = run(dir, bin);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /复用已有 D1 数据库/);
  assert.equal(idOf(r.toml), 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
});

test('库不存在时创建，并把新 id 写回 wrangler.toml', () => {
  const dir = prepare(TOML_TEMPLATE.replace('__PLACEHOLDER__', '在这里填写你的 D1 database_id'));
  const bin = fakeWrangler(dir, {
    existing: [{ name: 'other-db', uuid: '11111111-2222-3333-4444-555555555555' }],
    created: { name: 'filecove', uuid: '99999999-8888-7777-6666-555555555555' },
  });
  const r = run(dir, bin);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /已创建 D1 数据库/);
  assert.equal(idOf(r.toml), '99999999-8888-7777-6666-555555555555');
});

test('id 已正确时不动文件，原样保留', () => {
  const dir = prepare(TOML_TEMPLATE.replace('__PLACEHOLDER__', '12345678-abcd-ef01-2345-6789abcdef01'));
  const bin = fakeWrangler(dir, { existing: [] });
  const r = run(dir, bin);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /跳过创建/);
  assert.equal(idOf(r.toml), '12345678-abcd-ef01-2345-6789abcdef01');
});

test('缺少 Cloudflare 凭据时明确失败', () => {
  const dir = prepare(TOML_TEMPLATE.replace('__PLACEHOLDER__', '待填写'));
  const res = spawnSync(process.execPath, [join(dir, 'scripts', 'setup-resources.mjs')], {
    cwd: dir,
    encoding: 'utf8',
    env: { ...process.env, CLOUDFLARE_API_TOKEN: '', CLOUDFLARE_ACCOUNT_ID: '' },
  });
  assert.notEqual(res.status, 0);
  assert.match(`${res.stdout}${res.stderr}`, /CLOUDFLARE_API_TOKEN/);
});
