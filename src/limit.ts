// 限流 / 封禁 / 月度流量统计
import * as db from './db.js';
import { nowSec } from './util.js';

export async function isBanned(env, ip) {
  const row = await db.get(env, 'SELECT * FROM bans WHERE ip = ? AND until > ?', ip, nowSec());
  return row || null;
}

export async function banIp(env, ip, reason, minutes) {
  const until = nowSec() + Math.max(1, minutes) * 60;
  await db.run(
    env,
    'INSERT INTO bans (ip, reason, until, created_at) VALUES (?, ?, ?, ?) ON CONFLICT(ip) DO UPDATE SET reason = excluded.reason, until = excluded.until, created_at = excluded.created_at',
    ip,
    reason,
    until,
    nowSec()
  );
  return until;
}

export async function unbanIp(env, ip) {
  await db.run(env, 'DELETE FROM bans WHERE ip = ?', ip);
}

export async function listBans(env) {
  return await db.all(env, 'SELECT * FROM bans WHERE until > ? ORDER BY until DESC LIMIT 200', nowSec());
}

export async function ipDownloadCount(env, ip, windowSec) {
  const row = await db.get(
    env,
    "SELECT COUNT(*) AS c FROM logs WHERE ip = ? AND action = 'download' AND ts > ?",
    ip,
    nowSec() - windowSec
  );
  return row ? row.c : 0;
}

export function monthKey() {
  const d = new Date();
  return `traffic:${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export async function monthlyTraffic(env, delta = 0) {
  if (!delta) {
    const row = await db.get(env, 'SELECT v FROM counters WHERE k = ?', monthKey());
    return row ? row.v : 0;
  }
  return await db.bumpCounter(env, monthKey(), delta);
}
