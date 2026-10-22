-- Filecove 数据库结构（Worker 首次运行时会自动建表，此文件用于手动初始化 / 远程执行）
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
