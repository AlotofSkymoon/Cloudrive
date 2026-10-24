#!/usr/bin/env node
/**
 * 自动准备 Cloudflare 资源：D1 数据库 + R2 存储桶
 *
 * 主路径走 Cloudflare REST API（返回确定的 JSON，不依赖 wrangler 输出格式）；
 * 只有 REST 不可用（网络受限等）时才回退到 wrangler CLI 并解析文本输出。
 *
 * - D1：存在就复用，不存在就创建，然后把 uuid 写回 wrangler.toml 的 database_id
 * - R2：存在就跳过，不存在就创建
 *
 * 资源名（迁移兼容）：
 *   老项目（Filecove 时期）建的桶和库叫 filecove，里面是用户的文件。
 *   重新部署时按顺序探测：
 *     1. cloudrive —— 新名，优先复用（见过一次之后每次都是它）
 *     2. filecove  —— 老用户的库，找到了就继续用，绝不重建（数据在里面）
 *     3. 都没有     —— 新用户，创建 cloudrive
 *   探测到哪个就把哪个写回 wrangler.toml，下次不用再猜。
 *
 * 用法：
 *   CLOUDFLARE_API_TOKEN=xxx CLOUDFLARE_ACCOUNT_ID=xxx node scripts/setup-resources.mjs
 *   CLOUDFLARE_API_TOKEN=xxx CLOUDFLARE_ACCOUNT_ID=xxx npm run setup
 *
 * 可选环境变量：
 *   D1_DATABASE_NAME  覆盖 wrangler.toml 里的数据库名
 *   R2_BUCKET_NAME    覆盖 wrangler.toml 里的桶名
 *   D1_LOCATION       D1 位置提示：wnam/enam/weur/eeur/apac/oc
 *   R2_LOCATION       R2 位置提示：同上
 *   CF_API_BASE       覆盖 API 地址（测试用）
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const tomlPath = join(root, 'wrangler.toml');
const API_BASE = (process.env.CF_API_BASE || 'https://api.cloudflare.com/client/v4').replace(/\/+$/, '');
const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

// ---------- 资源名（迁移兼容）----------
const NEW_RESOURCE_NAME = 'cloudrive';
const LEGACY_RESOURCE_NAME = 'filecove';

/**
 * 探测顺序：新名 → 旧名。都不存在时创建 createAs（默认新名）。
 * 显式给了环境变量就只用它，不做迁移探测。
 */
function candidatesFor(explicit, configured) {
  if (explicit) return { probe: [explicit], createAs: explicit };
  const ordered = [];
  for (const n of [configured || NEW_RESOURCE_NAME, NEW_RESOURCE_NAME, LEGACY_RESOURCE_NAME]) {
    if (n && !ordered.includes(n)) ordered.push(n);
  }
  return { probe: ordered, createAs: ordered[0] };
}

// ---------- wrangler.toml ----------
function parseConfig(text) {
  const pick = (re) => (re.exec(text) || [])[1] || '';
  return {
    dbName: process.env.D1_DATABASE_NAME || pick(/database_name\s*=\s*"([^"]*)"/),
    dbId: pick(/database_id\s*=\s*"([^"]*)"/),
    bucket: process.env.R2_BUCKET_NAME || pick(/bucket_name\s*=\s*"([^"]*)"/),
  };
}

function replaceOrAppend(text, key, value) {
  const line = `${key} = "${value}"`;
  const re = new RegExp(`^\\s*${key}\\s*=.*$`, 'm');
  return re.test(text) ? text.replace(re, line) : `${text.trimEnd()}\n${line}\n`;
}

function writeDatabaseId(text, id) {
  const line = `database_id = "${id}"`;
  let out;
  if (/^\s*database_id\s*=.*$/m.test(text)) {
    out = text.replace(/^\s*database_id\s*=.*$/m, line);
  } else if (/^\s*database_name\s*=.*$/m.test(text)) {
    out = text.replace(/^(\s*database_name\s*=.*)$/m, `$1\n${line}`);
  } else {
    out = `${text.trimEnd()}\n${line}\n`;
  }
  writeFileSync(tomlPath, out, 'utf8');
}

// ---------- Cloudflare REST API ----------
async function cf(token, path, { method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    return { ok: false, status: 0, messages: [`网络请求失败：${e.message}`] };
  }
  const text = await res.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    /* 非 JSON 响应（如网关错误页），保留原文 */
  }
  const messages = (data?.errors || data?.messages || []).map((e) => e.message || String(e.code)).filter(Boolean);
  return {
    ok: res.ok && data?.success !== false,
    status: res.status,
    data,
    messages: messages.length ? messages : [text.slice(0, 300)],
  };
}

const looksLikeExists = (msg) => /already exists|already been created|already in use|duplicate/i.test(String(msg));

async function findD1(token, account, name) {
  // 先按名字精确查询，查不到再全量列表兜底（避免同名子串误判）
  const targeted = await cf(token, `/accounts/${account}/d1/database?per_page=100&name=${encodeURIComponent(name)}`);
  if (targeted.ok) {
    const hit = (targeted.data?.result || []).find((d) => d.name === name);
    if (hit?.uuid) return hit.uuid;
  }
  const all = await cf(token, `/accounts/${account}/d1/database?per_page=1000`);
  if (all.ok) {
    const hit = (all.data?.result || []).find((d) => d.name === name);
    if (hit?.uuid) return hit.uuid;
  }
  return null;
}

async function createD1(token, account, name) {
  const body = { name };
  if (process.env.D1_LOCATION) body.primary_location_hint = process.env.D1_LOCATION;
  const res = await cf(token, `/accounts/${account}/d1/database`, { method: 'POST', body });
  const uuid = res.data?.result?.uuid;
  if (uuid) return { uuid };
  if (res.messages.some(looksLikeExists)) {
    const existing = await findD1(token, account, name);
    if (existing) return { uuid: existing, existed: true };
  }
  return { error: res };
}

async function findR2(token, account, name) {
  // 桶列表可能分页，翻完为止，否则桶多的时候会漏判成「不存在」而误建
  let cursor;
  for (let page = 0; page < 50; page++) {
    const q = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '?per_page=1000';
    const res = await cf(token, `/accounts/${account}/r2/buckets${q}`);
    if (!res.ok) return false;
    const list = res.data?.result?.buckets || res.data?.result || [];
    if (list.some((b) => b.name === name)) return true;
    cursor = res.data?.result_info?.cursor || res.data?.result?.cursor;
    if (!cursor) return false;
  }
  return false;
}

async function createR2(token, account, name) {
  const body = { name };
  if (process.env.R2_LOCATION) body.locationHint = process.env.R2_LOCATION;
  const res = await cf(token, `/accounts/${account}/r2/buckets`, { method: 'POST', body });
  if (res.ok) return { ok: true };
  if (res.messages.some(looksLikeExists)) return { ok: true, existed: true };
  return { error: res };
}

// ---------- wrangler CLI 兜底（不依赖 --json，解析文本输出）----------
function wranglerParts() {
  if (process.env.WRANGLER_CMD) return process.env.WRANGLER_CMD.split(' ').filter(Boolean);
  const local = join(root, 'node_modules', '.bin', 'wrangler');
  if (existsSync(local)) return [local];
  return ['npx', 'wrangler'];
}

function wrangler(args) {
  const [bin, ...pre] = wranglerParts();
  const res = spawnSync(bin, [...pre, ...args], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    env: { ...process.env, WRANGLER_SEND_METRICS: '0', CI: '1', NO_COLOR: '1' },
  });
  const out = `${res.stdout || ''}${res.stderr || ''}`;
  return { code: res.status == null ? 1 : res.status, out };
}

function wranglerD1Uuid(name) {
  const list = wrangler(['d1', 'list']);
  const line = list.out.split('\n').find((l) => l.trim().startsWith(name));
  const fromList = line && UUID_RE.exec(line);
  if (fromList) return fromList[0];

  const created = wrangler(['d1', 'create', name]);
  const m = UUID_RE.exec(created.out);
  return m ? m[0] : null;
}

// ---------- GitHub Actions 输出 ----------
function githubOutput(kv) {
  const file = process.env.GITHUB_OUTPUT;
  if (!file) return;
  const body = Object.entries(kv)
    .map(([k, v]) => `${k}=${String(v).replace(/[\r\n]/g, ' ')}`)
    .join('\n');
  try {
    writeFileSync(file, body + '\n', { flag: 'a' });
  } catch {
    /* 非 CI 环境忽略 */
  }
}

function stepSummary(md) {
  const file = process.env.GITHUB_STEP_SUMMARY;
  if (!file) return;
  try {
    writeFileSync(file, md + '\n', { flag: 'a' });
  } catch {
    /* 忽略 */
  }
}

function fail(msg, detail) {
  console.error(`✗ ${msg}`);
  if (detail) console.error(`  ${detail}`);
}

// ---------- 主流程 ----------
async function main() {
  const token = (process.env.CLOUDFLARE_API_TOKEN || '').trim();
  const accountId = (process.env.CLOUDFLARE_ACCOUNT_ID || '').trim();
  if (!token || !accountId) {
    fail('缺少 CLOUDFLARE_API_TOKEN 或 CLOUDFLARE_ACCOUNT_ID。');
    console.error('  GitHub Actions：仓库 Settings → Secrets and variables → Actions 里添加这两项。');
    console.error('  本地执行：export CLOUDFLARE_API_TOKEN=... CLOUDFLARE_ACCOUNT_ID=... 后运行 npm run setup。');
    process.exit(1);
  }

  let toml = readFileSync(tomlPath, 'utf8');
  const cfg = parseConfig(toml);

  const dbNames = candidatesFor(process.env.D1_DATABASE_NAME, cfg.dbName);
  const bktNames = candidatesFor(process.env.R2_BUCKET_NAME, cfg.bucket);

  let uuid = UUID_RE.test(cfg.dbId || '') ? UUID_RE.exec(cfg.dbId)[0] : null;
  // 实际用到的库名（可能和 toml 里写的不一样——老用户会落到 filecove）
  let dbName = cfg.dbName || NEW_RESOURCE_NAME;

  /* ---------- D1 ---------- */
  if (uuid) {
    console.log(`• D1 database_id 已配置（${uuid}），跳过创建`);
  } else {


    // 依次探测：新名 → 旧名（老用户的库，数据在里面）
    for (const name of dbNames.probe) {
      console.log(`• 查找 D1 数据库：${name}`);
      const found = await findD1(token, accountId, name);
      if (found) {
        dbName = name;
        uuid = found;
        console.log(`✓ 复用已有 D1 数据库 ${name}（${uuid}）`);
        if (name === LEGACY_RESOURCE_NAME) {
          console.log('  ↳ 这是旧项目留下的库，继续复用（文件记录都在里面，不重建）');
        }
        break;
      }
    }

    if (!uuid) {
      console.log(`• 未找到，创建 D1 数据库：${dbNames.createAs}`);
      const created = await createD1(token, accountId, dbNames.createAs);
      if (created.uuid) {
        uuid = created.uuid;
        dbName = dbNames.createAs;
        console.log(
          created.existed
            ? `✓ 复用已有 D1 数据库 ${dbName}（${uuid}）`
            : `✓ 已创建 D1 数据库 ${dbName}（${uuid}）`
        );
      } else {
        const err = created.error;
        console.warn(`⚠ Cloudflare API 调用失败（HTTP ${err?.status}）：${(err?.messages || []).join(' / ')}`);
        console.warn('  回退到 wrangler CLI…');
        uuid = wranglerD1Uuid(dbNames.createAs);
        if (!uuid) {
          fail('创建 D1 数据库失败。常见原因：API 令牌缺少 D1 编辑权限，或账户未开通 D1。');
          console.error('  请给令牌加上 Account → D1 : 编辑 权限后重试。');
          process.exit(1);
        }
        dbName = dbNames.createAs;
        console.log(`✓ 已通过 wrangler 取得 D1 数据库 ${dbName}（${uuid}）`);
      }
    }

    // 把实际用到的名字和 id 写回，下次不用再探测
    if (dbName && dbName !== cfg.dbName) {
      toml = replaceOrAppend(toml, 'database_name', dbName);
      console.log(`✓ 已把 database_name 写回 wrangler.toml（${dbName}）`);
    }
    toml = replaceOrAppend(toml, 'database_id', uuid);
    writeFileSync(tomlPath, toml, 'utf8');
    console.log('✓ 已把 database_id 写入 wrangler.toml');
    stepSummary(
      `### Cloudflare 资源已就绪\n\n- D1 数据库：\`${dbName}\` → \`${uuid}\`\n- database_id 已写入 \`wrangler.toml\``
    );
  }

  /* ---------- R2 ---------- */
  let bucket = null;
  for (const name of bktNames.probe) {
    console.log(`• 检查 R2 存储桶：${name}`);
    if (await findR2(token, accountId, name)) {
      bucket = name;
      console.log(`✓ 复用已有 R2 存储桶 ${name}`);
      if (name === LEGACY_RESOURCE_NAME) {
        console.log('  ↳ 这是旧项目留下的桶，继续复用（文件都在里面，不重建）');
      }
      break;
    }
  }

  if (!bucket) {
    bucket = bktNames.createAs;
    const r2 = await createR2(token, accountId, bucket);
    if (r2.ok) {
      console.log(r2.existed ? `✓ 复用已有 R2 存储桶 ${bucket}` : `✓ R2 存储桶 ${bucket} 已创建`);
    } else {
      console.warn(`⚠ Cloudflare API 创建 R2 桶失败（HTTP ${r2.error?.status}）：${(r2.error?.messages || []).join(' / ')}`);
      const fallback = wrangler(['r2', 'bucket', 'create', bucket]);
      if (fallback.code === 0 || /already exists|already been created|already in use/i.test(fallback.out)) {
        console.log(`✓ R2 存储桶 ${bucket} 已就绪（wrangler 兜底）`);
      } else {
        console.warn('  ⚠ R2 桶创建失败。请给令牌加上 Account → R2 : 编辑 权限，或手动创建同名桶后重跑。');
      }
    }
  }

  if (bucket !== cfg.bucket) {
    toml = readFileSync(tomlPath, 'utf8'); // 上面可能刚写过，重新读再改
    toml = replaceOrAppend(toml, 'bucket_name', bucket);
    writeFileSync(tomlPath, toml, 'utf8');
    console.log(`✓ 已把 bucket_name 写回 wrangler.toml（${bucket}）`);
  }

  githubOutput({ 'database-id': uuid, 'database-name': dbName || cfg.dbName, 'bucket-name': bucket });
}

main().catch((e) => {
  fail('准备资源时出现未预期的错误。', e && e.message);
  process.exit(1);
});
