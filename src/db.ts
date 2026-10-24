import { normalizeOrigin, nowSec } from './util.js';

// D1 数据层：建表、查询、配置读写
const SCHEMA = `
CREATE TABLE IF NOT EXISTS files (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  size INTEGER NOT NULL DEFAULT 0,
  mime TEXT,
  uploaded_at INTEGER NOT NULL,
  ip TEXT
);
CREATE INDEX IF NOT EXISTS idx_files_time ON files(uploaded_at DESC);

CREATE TABLE IF NOT EXISTS shares (
  code TEXT PRIMARY KEY,
  file_id TEXT NOT NULL,
  password_hash TEXT,
  salt TEXT,
  expires_at INTEGER NOT NULL DEFAULT 0,
  max_downloads INTEGER NOT NULL DEFAULT 0,
  downloads INTEGER NOT NULL DEFAULT 0,
  traffic INTEGER NOT NULL DEFAULT 0,
  show_name INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  last_at INTEGER,
  disabled INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_shares_file ON shares(file_id);

CREATE TABLE IF NOT EXISTS logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER NOT NULL,
  action TEXT,
  code TEXT,
  file_id TEXT,
  ip TEXT,
  country TEXT,
  ua TEXT,
  bytes INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_logs_ts ON logs(ts DESC);
CREATE INDEX IF NOT EXISTS idx_logs_ip ON logs(ip, ts);

CREATE TABLE IF NOT EXISTS bans (
  ip TEXT PRIMARY KEY,
  reason TEXT,
  until INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS counters (
  k TEXT PRIMARY KEY,
  v INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER
);

CREATE TABLE IF NOT EXISTS settings (
  k TEXT PRIMARY KEY,
  v TEXT
);
`;

const ready = new WeakSet();

// 默认配置：首次运行时写进数据库，之后一律以网页里改的值为准。
// 这样绝大多数配置不需要碰环境变量，也不会被部署冲掉。
// 改这里请同步 scripts/preset-vars.mjs 里的说明。
export const SEED_DEFAULTS = {
  STORAGE_DRIVER: 'auto',
  R2_BUCKET_NAME: 'cloudrive',
  DOWNLOAD_MODE: 'auto',
  IP_MAX_DOWNLOADS: '30',
  IP_WINDOW_SECONDS: '3600',
  BAN_MINUTES: '60',
  MONTHLY_TRAFFIC_LIMIT: '0',
  UPLOAD_MAX_SIZE: '107374182400',
  MULTIPART_THRESHOLD: '104857600',
  MULTIPART_PART_SIZE: '16777216',
  TURNSTILE_ENABLED: '0',
  // 容量上限（GB），仅用于侧栏进度条显示；0 = 不显示进度
  STORAGE_QUOTA_GB: '10',
};

// 只补缺失的键，已有的（用户改过的）一律不动
export async function seedConfig(env) {
  if (!env.DB) return;
  const rows = await all(env, 'SELECT k FROM settings');
  const have = new Set(rows.map((r) => r.k));
  for (const [k, v] of Object.entries(SEED_DEFAULTS)) {
    if (have.has(k)) continue;
    await run(env, 'INSERT INTO settings (k, v, updated_at) VALUES (?, ?, ?)', k, v, nowSec());
  }
}

// 把数据库里的设置合并进 env，让各处代码照旧读 env.X 就能拿到网页里配的值。
// ADMIN_PASSWORD 例外：环境变量优先级更高（已有逻辑如此），不覆盖。
export async function envWithSettings(env) {
  const s = await allSettings(env);
  if (!s || !Object.keys(s).length) return env;
  const merged = Object.assign(Object.create(null), env);
  for (const [k, v] of Object.entries(s)) {
    if (k === 'admin_hash') continue;
    if (k === 'ADMIN_PASSWORD') continue;
    merged[k] = v;
  }
  return merged;
}

export async function init(env) {
  const db = env.DB;
  if (!db || ready.has(db)) return;
  for (const stmt of SCHEMA.split(';')) {
    const s = stmt.trim();
    if (s) await db.prepare(s).run();
  }
  ready.add(db);
  // 建表后立刻补上默认配置，之后一切以网页/数据库为准
  await seedConfig(env).catch(() => {});
}

export async function all(env, sql, ...params) {
  const res = await env.DB.prepare(sql).bind(...params).all();
  return res.results || [];
}

export async function get(env, sql, ...params) {
  return await env.DB.prepare(sql).bind(...params).first();
}

export async function run(env, sql, ...params) {
  return await env.DB.prepare(sql).bind(...params).run();
}

export async function allSettings(env) {
  const rows = await all(env, 'SELECT k, v FROM settings');
  const out = {};
  for (const r of rows) out[r.k] = r.v;
  return out;
}

export async function setSetting(env, k, v) {
  await run(env, 'INSERT INTO settings (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v', k, String(v));
}

// 每个配置项的来源，用于在后台说明「这个值现在是从哪来的」
export async function configSources(env) {
  const s = await allSettings(env);
  const has = (k) => s[k] != null && s[k] !== '';
  const envHas = (k) => env[k] != null && env[k] !== '';
  const one = (k) => (has(k) ? '后台设置' : envHas(k) ? '环境变量' : '内置默认');
  return {
    PUBLIC_BASE_URL: one('PUBLIC_BASE_URL'),
    DOWNLOAD_MODE: one('DOWNLOAD_MODE'),
    IP_MAX_DOWNLOADS: one('IP_MAX_DOWNLOADS'),
    BAN_MINUTES: one('BAN_MINUTES'),
    MONTHLY_TRAFFIC_LIMIT: one('MONTHLY_TRAFFIC_LIMIT'),
    TURNSTILE_SITEKEY: one('TURNSTILE_SITEKEY'),
    TURNSTILE_SECRET: one('TURNSTILE_SECRET'),
    TURNSTILE_ENABLED: one('TURNSTILE_ENABLED'),
    UPLOAD_MAX_SIZE: one('UPLOAD_MAX_SIZE'),
    IP_WINDOW_SECONDS: one('IP_WINDOW_SECONDS'),
    STORAGE_DRIVER: one('STORAGE_DRIVER'),
    S3_ENDPOINT: one('S3_ENDPOINT'),
    S3_BUCKET: one('S3_BUCKET'),
    MULTIPART_THRESHOLD: one('MULTIPART_THRESHOLD'),
    STORAGE_QUOTA_GB: one('STORAGE_QUOTA_GB'),
  };
}

// 数据库设置（UI 里改过的）优先，环境变量作为初始默认值
export async function config(env) {
  const s = await allSettings(env);
  const pick = (key, def = '') => (s[key] != null && s[key] !== '' ? String(s[key]) : env[key] != null && env[key] !== '' ? String(env[key]) : String(def));
  return {
    publicBaseUrl: normalizeOrigin(pick('PUBLIC_BASE_URL', '')),
    downloadMode: pick('DOWNLOAD_MODE', 'auto'), // auto | public | signed | proxy
    monthlyTrafficLimit: Number(pick('MONTHLY_TRAFFIC_LIMIT', '0')) || 0,
    ipMaxDownloads: Number(pick('IP_MAX_DOWNLOADS', '30')) || 30,
    ipWindowSec: Number(pick('IP_WINDOW_SECONDS', '3600')) || 3600,
    banMinutes: Number(pick('BAN_MINUTES', '60')) || 60,
    turnstileSitekey: pick('TURNSTILE_SITEKEY', ''),
    turnstileSecret: pick('TURNSTILE_SECRET', ''),
    turnstileEnabled: pick('TURNSTILE_ENABLED', '0') === '1',
    uploadMaxSize: Number(pick('UPLOAD_MAX_SIZE', '107374182400')) || 107374182400,
    multipartThreshold: Number(pick('MULTIPART_THRESHOLD', '104857600')) || 104857600,
    multipartPartSize: Number(pick('MULTIPART_PART_SIZE', '16777216')) || 16777216,
    // 存储相关（网页里可改，密钥只告诉前端有没有填，不回传值）
    storageDriver: pick('STORAGE_DRIVER', 'auto'),
    r2BucketName: pick('R2_BUCKET_NAME', 'cloudrive'),
    s3Endpoint: pick('S3_ENDPOINT', ''),
    s3Bucket: pick('S3_BUCKET', ''),
    s3Region: pick('S3_REGION', 'auto'),
    s3ForcePathStyle: pick('S3_FORCE_PATH_STYLE', 'true') !== 'false',
    s3HasKey: !!(pick('S3_ACCESS_KEY_ID', '') && pick('S3_SECRET_ACCESS_KEY', '')),
    storageQuotaGb: Number(pick('STORAGE_QUOTA_GB', '10')) || 0,
  };
}

export async function bumpCounter(env, k, delta) {
  await run(
    env,
    'INSERT INTO counters (k, v, updated_at) VALUES (?, ?, ?) ON CONFLICT(k) DO UPDATE SET v = v + excluded.v, updated_at = excluded.updated_at',
    k,
    delta,
    Math.floor(Date.now() / 1000)
  );
  const row = await get(env, 'SELECT v FROM counters WHERE k = ?', k);
  return row ? row.v : delta;
}
