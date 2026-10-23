import { normalizeOrigin } from './util.js';

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

export async function init(env) {
  const db = env.DB;
  if (!db || ready.has(db)) return;
  for (const stmt of SCHEMA.split(';')) {
    const s = stmt.trim();
    if (s) await db.prepare(s).run();
  }
  ready.add(db);
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
