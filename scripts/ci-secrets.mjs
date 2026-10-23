#!/usr/bin/env node
/**
 * 计算本次部署「真正需要上传」的 Worker 密钥名单。
 *
 * 背景：cloudflare/wrangler-action 的 secrets 输入要求每个名字在工作流的 env 里
 * 都有非空值——只要列了一个没配的（比如没用 Turnstile 就没设 TURNSTILE_SECRET），
 * 它就会报 `Value for secret XXX not found in environment` 并让整个部署失败。
 * 所以这里先把候选名单过滤一遍，只输出确实配了值的那些。
 *
 * 输出：
 *   - stdout：人类可读的清单（只打印名字，绝不打印值）
 *   - $GITHUB_OUTPUT：names=<换行分隔的名字列表>，供 wrangler-action 的 secrets 输入使用
 *
 * 用法：
 *   ADMIN_PASSWORD=xxx node scripts/ci-secrets.mjs
 *   ADMIN_PASSWORD=xxx CI_SECRETS_CANDIDATES="ADMIN_PASSWORD,FOO" node scripts/ci-secrets.mjs
 */
import { appendFileSync } from 'node:fs';

const DEFAULT_CANDIDATES = ['ADMIN_PASSWORD', 'TURNSTILE_SECRET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY'];
const REQUIRED = ['ADMIN_PASSWORD'];

export function pickSecrets(env = process.env, candidates = DEFAULT_CANDIDATES) {
  const list = (env.CI_SECRETS_CANDIDATES || '').split(',').map((s) => s.trim()).filter(Boolean);
  const names = list.length ? list : candidates;
  return {
    set: names.filter((n) => String(env[n] ?? '').length > 0),
    unset: names.filter((n) => String(env[n] ?? '').length === 0),
  };
}

// 主流程：直接执行时才跑（被测试 import 时不跑）
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const { set, unset } = pickSecrets();
  const missingRequired = REQUIRED.filter((n) => !set.includes(n));

  if (missingRequired.length) {
    console.error(`✗ 缺少必需的密钥：${missingRequired.join(', ')}`);
    console.error('  请到仓库 Settings → Secrets and variables → Actions 里添加后重跑。');
    process.exit(1);
  }
  console.log(`• 将上传 ${set.length} 个密钥：${set.join(', ') || '（无）'}`);
  if (unset.length) console.log(`• 未配置，已跳过：${unset.join(', ')}`);

  const file = process.env.GITHUB_OUTPUT;
  if (file) {
    const delim = `secrets-${Math.random().toString(36).slice(2, 10)}`;
    appendFileSync(file, `names<<${delim}\n${set.join('\n')}\n${delim}\n`);
  }
}
