#!/usr/bin/env node
/**
 * 自动准备 Cloudflare 资源：D1 数据库 + R2 存储桶
 *
 * - D1：已存在同名库就复用，不存在就创建，然后把 database_id 写回 wrangler.toml
 * - R2：已存在同名桶就跳过，不存在就创建
 *
 * 用法：
 *   CLOUDFLARE_API_TOKEN=xxx CLOUDFLARE_ACCOUNT_ID=xxx node scripts/setup-resources.mjs
 *   CLOUDFLARE_API_TOKEN=xxx CLOUDFLARE_ACCOUNT_ID=xxx npm run setup
 *
 * 环境变量（可选）：
 *   D1_DATABASE_NAME  覆盖 wrangler.toml 里的数据库名
 *   R2_BUCKET_NAME    覆盖 wrangler.toml 里的桶名
 *   R2_LOCATION       R2 桶区域（留空由 Cloudflare 自动选择）
 *   WRANGLER_CMD      指定 wrangler 可执行文件，仅测试用
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const tomlPath = join(root, 'wrangler.toml');
const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

// ---------- wrangler.toml 解析 ----------
function parseConfig(text) {
  const pick = (re) => (re.exec(text) || [])[1] || '';
  return {
    dbName: process.env.D1_DATABASE_NAME || pick(/database_name\s*=\s*"([^"]*)"/),
    dbId: pick(/database_id\s*=\s*"([^"]*)"/),
    bucket: process.env.R2_BUCKET_NAME || pick(/bucket_name\s*=\s*"([^"]*)"/),
  };
}

// ---------- 调用 wrangler CLI ----------
function wranglerParts() {
  const cmd = process.env.WRANGLER_CMD;
  if (cmd) return cmd.split(' ').filter(Boolean);
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
  return {
    code: res.status == null ? 1 : res.status,
    stdout: res.stdout || '',
    stderr: res.stderr || '',
    out: `${res.stdout || ''}${res.stderr || ''}`,
  };
}

// ---------- 从 JSON / 文本里提取数据库列表 ----------
function extractDatabases(text) {
  const found = [];

  const walk = (node) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) return node.forEach(walk);
    const name = node.name;
    const uuid = node.uuid || node.database_id || node.id;
    if (typeof name === 'string' && typeof uuid === 'string' && UUID_RE.test(uuid)) {
      found.push({ name, uuid: (UUID_RE.exec(uuid) || [uuid])[0] });
      return;
    }
    Object.values(node).forEach(walk);
  };

  try {
    walk(JSON.parse(text));
  } catch {
    // wrangler 输出可能夹杂提示信息，用正则兜底：name 与 uuid 成对出现
    const re = /"name"\s*:\s*"([^"]+)"[\s\S]{0,400}?"uuid"\s*:\s*"([0-9a-f-]{36})"/gi;
    let m;
    while ((m = re.exec(text))) found.push({ name: m[1], uuid: m[2] });
  }
  return found;
}

function firstUuid(text) {
  try {
    const data = JSON.parse(text);
    const stack = [data];
    while (stack.length) {
      const cur = stack.pop();
      if (typeof cur === 'string' && UUID_RE.test(cur)) return UUID_RE.exec(cur)[0];
      if (cur && typeof cur === 'object') stack.push(...Object.values(cur));
    }
  } catch {
    /* 落到正则兜底 */
  }
  const m = UUID_RE.exec(text);
  return m ? m[0] : null;
}

// ---------- 写回 wrangler.toml ----------
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

// ---------- 主流程 ----------
function main() {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  if (!token || !accountId) {
    console.error('✗ 缺少 CLOUDFLARE_API_TOKEN 或 CLOUDFLARE_ACCOUNT_ID。');
    console.error('  本地执行：先 login（npx wrangler login）并设置好这两个环境变量；');
    console.error('  GitHub Actions：在仓库 Settings → Secrets 里添加这两项。');
    process.exit(1);
  }

  const raw = readFileSync(tomlPath, 'utf8');
  const cfg = parseConfig(raw);
  const dbName = cfg.dbName || 'filecove';
  const bucket = cfg.bucket || 'filecove';

  // 已填了合法 id 就跳过重复创建
  if (UUID_RE.test(cfg.dbId || '')) {
    console.log(`• D1 database_id 已配置（${cfg.dbId}），跳过创建`);
    githubOutput({ 'database-id': cfg.dbId, 'bucket-name': bucket, 'database-name': dbName });
  } else {
    console.log(`• 查找 D1 数据库：${dbName}`);
    const list = wrangler(['d1', 'list', '--json']);
    let uuid = extractDatabases(list.out).find((d) => d.name === dbName)?.uuid || null;

    if (!uuid) {
      if (list.code !== 0 && !/not (been|yet) (enabled|created)/i.test(list.out)) {
        // list 失败可能是权限或网络问题，而不是"库不存在"，提示后继续尝试创建
        console.warn(`⚠ wrangler d1 list 失败（code ${list.code}），仍尝试创建。输出：${list.out.slice(0, 300)}`);
      }
      console.log(`• 未找到，创建 D1 数据库：${dbName}`);
      const created = wrangler(['d1', 'create', dbName, '--json']);
      uuid = firstUuid(created.out);
      if (!uuid) {
        console.error('✗ 创建 D1 数据库失败，wrangler 输出如下：');
        console.error(created.out.slice(0, 1200));
        process.exit(1);
      }
      console.log(`✓ 已创建 D1 数据库 ${dbName}（${uuid}）`);
    } else {
      console.log(`✓ 复用已有 D1 数据库 ${dbName}（${uuid}）`);
    }

    writeDatabaseId(raw, uuid);
    console.log('✓ 已把 database_id 写入 wrangler.toml');
    githubOutput({ 'database-id': uuid, 'database-name': dbName, 'bucket-name': bucket });
    stepSummary(`### Cloudflare 资源已就绪\n\n- D1 数据库：\`${dbName}\` → \`${uuid}\`\n- database_id 已写入 \`wrangler.toml\``);
  }

  // R2 存储桶：已存在就跳过
  console.log(`• 检查 R2 存储桶：${bucket}`);
  const args = ['r2', 'bucket', 'create', bucket];
  if (process.env.R2_LOCATION) args.push('--location', process.env.R2_LOCATION);
  const r2 = wrangler(args);
  if (r2.code === 0) {
    console.log(`✓ R2 存储桶 ${bucket} 已就绪`);
  } else if (/already exists|already been created|already in use/i.test(r2.out)) {
    console.log(`✓ 复用已有 R2 存储桶 ${bucket}`);
  } else {
    console.warn(`⚠ 创建 R2 存储桶 ${bucket} 失败（code ${r2.code}）：${r2.out.slice(0, 300)}`);
    console.warn('  若桶已存在可忽略；否则请手动创建后重跑本步骤。');
  }
}

main();
