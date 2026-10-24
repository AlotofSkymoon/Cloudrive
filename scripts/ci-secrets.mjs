#!/usr/bin/env node
/**
 * 计算本次部署「真正需要上传」的 Worker 密钥名单。
 *
 * 有两条约束，解决的是同一个诉求——别把你在控制台配好的值冲掉：
 *
 * 1. cloudflare/wrangler-action 的 secrets 输入要求每个名字在工作流的 env 里
 *    都有非空值，只要列了一个没配的（比如没用 Turnstile），它就报
 *    `Value for secret XXX not found in environment` 并让整个部署失败。
 *    所以只把确实配了值的名字列进去。
 * 2. 如果某个密钥在 GitHub Secrets 里没配，但 Worker 上已经有了
 *    （你在控制台手动设过），那就**不上传也不报错**，保留控制台的值。
 *
 * 输出：
 *   - stdout：人类可读的清单（只打印名字，绝不打印值）
 *   - $GITHUB_OUTPUT：names=<换行分隔的名字列表>
 */
import { appendFileSync } from 'node:fs';

const DEFAULT_CANDIDATES = ['ADMIN_PASSWORD', 'TURNSTILE_SECRET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY'];
const REQUIRED = ['ADMIN_PASSWORD'];
const API_BASE = (process.env.CF_API_BASE || 'https://api.cloudflare.com/client/v4').replace(/\/+$/, '');

// 「哪些要上传 / 哪些保留 Worker 上的 / 哪些完全没有」，纯逻辑，便于测试
export function resolveSecrets({ env = {}, candidates = DEFAULT_CANDIDATES, existing = new Set() } = {}) {
  const list = (env.CI_SECRETS_CANDIDATES || '').split(',').map((s) => s.trim()).filter(Boolean);
  const names = list.length ? list : candidates;
  const set = [];
  const kept = [];
  const unset = [];
  for (const n of names) {
    if (String(env[n] ?? '').length > 0) set.push(n);
    else if (existing.has(n)) kept.push(n);
    else unset.push(n);
  }
  const missing = REQUIRED.filter((n) => !set.includes(n) && !kept.includes(n));
  return { set, kept, unset, missing };
}

// 查询 Worker 上已有的密钥名单（只返回名字，拿不到值）；失败时返回 null 由调用方降级
export async function fetchExistingSecrets({ token, account, script }) {
  if (!token || !account || !script) return null;
  try {
    const res = await fetch(`${API_BASE}/accounts/${account}/workers/scripts/${script}/secrets`, {
      headers: { authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const arr = Array.isArray(data?.result) ? data.result : [];
    return new Set(arr.map((x) => x && x.name).filter(Boolean));
  } catch {
    return null;
  }
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const env = process.env;
  const script = env.CF_WORKER_NAME || 'cloudrive';
  let existing = await fetchExistingSecrets({
    token: (env.CLOUDFLARE_API_TOKEN || '').trim(),
    account: (env.CLOUDFLARE_ACCOUNT_ID || '').trim(),
    script,
  });
  if (!existing) {
    // 查不到就按「Worker 上什么都没有」处理，行为退化为上一版
    existing = new Set();
    console.log('• 未能读取 Worker 上已有的密钥名单，按未配置处理');
  }

  const { set, kept, unset, missing } = resolveSecrets({ env, existing });

  if (missing.length) {
    console.error(`✗ 缺少必需的密钥：${missing.join(', ')}`);
    console.error('  两种方式任选其一：');
    console.error('  1. 仓库 Settings → Secrets and variables → Actions 里添加对应 Secret');
    console.error(`  2. 或直接在 Cloudflare 控制台 Workers → ${script} → 设置 → 变量和机密 里添加（之后部署会保留它）`);
    process.exit(1);
  }

  console.log(`• 将上传 ${set.length} 个密钥：${set.join(', ') || '（无）'}`);
  if (kept.length) {
    console.log(`• 以下已在 Worker 上配置，本次不覆盖：${kept.join(', ')}`);
  }
  if (unset.length) console.log(`• 未配置，已跳过：${unset.join(', ')}`);

  const file = process.env.GITHUB_OUTPUT;
  if (file && set.length) {
    const delim = `secrets-${Math.random().toString(36).slice(2, 10)}`;
    appendFileSync(file, `names<<${delim}\n${set.join('\n')}\n${delim}\n`);
  }
}
