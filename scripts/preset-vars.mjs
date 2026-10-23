#!/usr/bin/env node
/**
 * 可选：由 Actions 写入一批 Worker 文本变量（vars）。
 *
 * 默认什么都不做——这样你在 Cloudflare 控制台改的变量（比如 PUBLIC_BASE_URL）
 * 每次部署都会完整保留；因为 wrangler.toml 里没有声明 [vars]，部署也不会同步覆盖。
 *
 * 只有当你填了 PRESET_VARS 时才会写入，格式是每行一个 KEY=VALUE：
 *
 *   PUBLIC_BASE_URL=https://cdn.example.com
 *   DOWNLOAD_MODE=auto
 *   # 井号开头是注释，空行会被忽略
 *
 * 建议把它配成仓库【变量】（Settings → Variables），而不是机密，方便查看与修改。
 *
 * 输出：
 *   - $GITHUB_ENV：KEY=VALUE，供 wrangler-action 的 env 取值
 *   - $GITHUB_OUTPUT：names=<换行分隔的变量名>，供 wrangler-action 的 vars 输入使用
 */
import { appendFileSync } from 'node:fs';

// 允许预设的变量名白名单，防止手滑把敏感项写进来（密钥请走 Secrets）
const ALLOWED = new Set([
  'PUBLIC_BASE_URL',
  'DOWNLOAD_MODE',
  'STORAGE_DRIVER',
  'R2_BUCKET_NAME',
  'IP_MAX_DOWNLOADS',
  'IP_WINDOW_SECONDS',
  'BAN_MINUTES',
  'MONTHLY_TRAFFIC_LIMIT',
  'UPLOAD_MAX_SIZE',
  'MULTIPART_THRESHOLD',
  'MULTIPART_PART_SIZE',
  'TURNSTILE_SITEKEY',
  'TURNSTILE_ENABLED',
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
    else if (!ALLOWED.has(key)) errors.push(`变量 ${key} 不在允许预设的白名单里（密钥类请用 Secrets）`);
    else pairs.push({ key, value });
  }
  return { pairs, errors };
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const { pairs, errors } = parsePreset(process.env.PRESET_VARS);

  if (errors.length) {
    console.error('✗ PRESET_VARS 里有无法识别的条目：');
    errors.forEach((e) => console.error(`  - ${e}`));
    process.exit(1);
  }

  if (!pairs.length) {
    console.log('• 未配置 PRESET_VARS，本次部署不写入任何变量');
    console.log('  → 你在控制台改的值（含 PUBLIC_BASE_URL）会完整保留');
  } else {
    console.log(`• 将写入 ${pairs.length} 个变量：${pairs.map((p) => p.key).join(', ')}`);
    console.log('  注意：这些值会覆盖控制台里的同名变量（其余变量不受影响）');
  }

  const envFile = process.env.GITHUB_ENV;
  const outFile = process.env.GITHUB_OUTPUT;
  const delim = () => `fc-${Math.random().toString(36).slice(2, 10)}`;

  if (envFile) {
    for (const { key, value } of pairs) {
      const d = delim();
      appendFileSync(envFile, `${key}<<${d}\n${value}\n${d}\n`);
    }
  }
  if (outFile && pairs.length) {
    const d = delim();
    appendFileSync(outFile, `names<<${d}\n${pairs.map((p) => p.key).join('\n')}\n${d}\n`);
  }
}
