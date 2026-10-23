#!/usr/bin/env node
/**
 * 往 Worker 写文本变量（vars），原则是「只补缺，不覆盖」。
 *
 * 诉求来自两个方向：
 * - 部署后控制台能看见一整套默认配置，不用自己一个个加；
 * - 但又不能每次部署都把你在控制台改过的值冲回默认。
 *
 * 所以这里的规则是：
 *   1. Worker 上还没有的变量 → 用默认值补上（首次部署会看到一整排）
 *   2. Worker 上已经有了的 → 原样保留，绝不动
 *   3. PRESET_VARS 里显式写明的 → 以它为准，覆盖同名变量（这是你主动声明的）
 *
 * 默认值与代码里的兜底值保持一致，改一处请同步另一处。
 *
 * 输出：
 *   - $GITHUB_ENV：KEY=VALUE，供 wrangler-action 取值
 *   - $GITHUB_OUTPUT：names=<换行分隔的变量名>，供 wrangler-action 的 vars 输入使用
 */
import { appendFileSync } from 'node:fs';

const API_BASE = (process.env.CF_API_BASE || 'https://api.cloudflare.com/client/v4').replace(/\/+$/, '');

// 默认值清单：与 src/db.js 的 config() / src/storage.js 里的兜底值一致
export const DEFAULTS = {
  STORAGE_DRIVER: 'auto',
  R2_BUCKET_NAME: 'filecove',
  DOWNLOAD_MODE: 'auto',
  IP_MAX_DOWNLOADS: '30',
  IP_WINDOW_SECONDS: '3600',
  BAN_MINUTES: '60',
  MONTHLY_TRAFFIC_LIMIT: '0',
  UPLOAD_MAX_SIZE: '107374182400',
  MULTIPART_THRESHOLD: '104857600',
  MULTIPART_PART_SIZE: '16777216',
  TURNSTILE_ENABLED: '0',
  // PUBLIC_BASE_URL / TURNSTILE_SITEKEY / S3_* 留空才有意义，不预设，
  // 免得写出一堆空值把控制台搞乱（空值也不会覆盖已有值）
};

// 允许写入的白名单（密钥类一律走 Secrets，不在这里）
const ALLOWED = new Set([
  ...Object.keys(DEFAULTS),
  'PUBLIC_BASE_URL',
  'TURNSTILE_SITEKEY',
  'S3_ENDPOINT',
  'S3_BUCKET',
  'S3_REGION',
  'S3_FORCE_PATH_STYLE',
]);

export function parsePreset(raw) {
  const pairs = [];
  const errors = [];
  for (const line of String(raw || '').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i <= 0) {
      errors.push(`格式不对（应为 KEY=VALUE）：${t}`);
      continue;
    }
    const key = t.slice(0, i).trim();
    const value = t.slice(i + 1).trim();
    if (!/^[A-Z0-9_]+$/.test(key)) errors.push(`变量名不合法：${key}`);
    else if (!ALLOWED.has(key)) errors.push(`变量 ${key} 不在白名单里（密钥类请用 Secrets）`);
    else pairs.push({ key, value });
  }
  return { pairs, errors };
}

// 决定最终要写哪些：defaultsOnly 表示「只在缺失时补默认值」
export function planVars({ defaults = DEFAULTS, presetPairs = [], existing = new Set() } = {}) {
  const out = [];
  const add = (key, value, reason) => out.push({ key, value, reason });

  // 1) 显式声明的优先，无条件写入
  const presetKeys = new Set();
  for (const { key, value } of presetPairs) {
    presetKeys.add(key);
    add(key, value, existing.has(key) ? '按 PRESET_VARS 覆盖' : '来自 PRESET_VARS');
  }
  // 2) 其余默认值只在 Worker 上没有时补
  for (const [key, value] of Object.entries(defaults)) {
    if (presetKeys.has(key)) continue;
    if (existing.has(key)) continue;
    add(key, value, '补上缺失的默认值');
  }
  return out;
}

// 读取 Worker 上已有的文本变量名称（拿不到值时 API 不返回 text，只有名字也够用）
export async function fetchExistingVars({ token, account, script }) {
  if (!token || !account || !script) return null;
  try {
    const res = await fetch(`${API_BASE}/accounts/${account}/workers/scripts/${script}/settings`, {
      headers: { authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const bindings = Array.isArray(data?.result?.bindings) ? data.result.bindings : [];
    // 文本变量的类型是 plain_text；secret_text 走另一条路，不算在内
    return new Set(bindings.filter((b) => b && b.type === 'plain_text' && b.name).map((b) => b.name));
  } catch {
    return null;
  }
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const env = process.env;
  const script = env.CF_WORKER_NAME || 'filecove';

  const { pairs, errors } = parsePreset(env.PRESET_VARS);
  if (errors.length) {
    console.error('✗ PRESET_VARS 里有无法识别的条目：');
    errors.forEach((e) => console.error(`  - ${e}`));
    process.exit(1);
  }

  let existing = await fetchExistingVars({
    token: (env.CLOUDFLARE_API_TOKEN || '').trim(),
    account: (env.CLOUDFLARE_ACCOUNT_ID || '').trim(),
    script,
  });
  if (!existing) {
    // 查不到（多半是首次部署，Worker 还不存在）——按「都没有」处理，把默认值铺一遍
    existing = new Set();
    console.log('• 读不到 Worker 上已有的变量，按首次部署处理，将补上全部默认值');
  } else if (existing.size) {
    console.log(`• Worker 上已有 ${existing.size} 个文本变量，已存在的不会被改动`);
  }

  const plan = planVars({ presetPairs: pairs, existing });

  if (!plan.length) {
    console.log('• 变量都已就位，本次不写入任何变量');
  } else {
    const byReason = plan.reduce((acc, x) => ((acc[x.reason] ||= []).push(x.key), acc), {});
    for (const [reason, keys] of Object.entries(byReason)) {
      console.log(`• ${reason}（${keys.length}）：${keys.join(', ')}`);
    }
  }

  const envFile = env.GITHUB_ENV;
  const outFile = env.GITHUB_OUTPUT;
  const delim = () => `fc-${Math.random().toString(36).slice(2, 10)}`;

  if (envFile) {
    for (const { key, value } of plan) {
      const d = delim();
      appendFileSync(envFile, `${key}<<${d}\n${value}\n${d}\n`);
    }
  }
  if (outFile && plan.length) {
    const d = delim();
    appendFileSync(outFile, `names<<${d}\n${plan.map((p) => p.key).join('\n')}\n${d}\n`);
  }
}
