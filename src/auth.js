// 鉴权：管理员会话 Cookie（HMAC 签名，无第三方库）+ 分享密码哈希
import { sha256Hex, hmacHex, b64urlEncode, b64urlDecode, nowSec, timingSafeEqual, randomId } from './util.js';
import * as db from './db.js';

function secret(env) {
  return env.ADMIN_PASSWORD || env.SESSION_SECRET || 'filecove-default-secret';
}

export async function signToken(env, payload, ttlSec = 60 * 60 * 12) {
  const body = b64urlEncode(JSON.stringify({ ...payload, exp: nowSec() + ttlSec }));
  const sig = await hmacHex(secret(env), body);
  return `${body}.${sig}`;
}

export async function verifyToken(env, token) {
  if (!token || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  const expect = await hmacHex(secret(env), body);
  if (!timingSafeEqual(sig, expect)) return null;
  try {
    const data = JSON.parse(b64urlDecode(body));
    if (data.exp && data.exp < nowSec()) return null;
    return data;
  } catch {
    return null;
  }
}

export function cookieHeader(name, value, maxAge = 60 * 60 * 12) {
  return `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

export function clearCookie(name) {
  return `${name}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export function readCookie(request, name) {
  const raw = request.headers.get('cookie') || '';
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

export async function isAdmin(request, env) {
  const token = readCookie(request, 'adm');
  const data = await verifyToken(env, token);
  return !!(data && data.role === 'admin');
}

export async function hashPassword(password, salt) {
  return await sha256Hex(`${salt}:${password}:filecove`);
}

export async function adminPasswordHash(env) {
  // 环境变量优先，其次数据库（UI 里改过密码的情况）
  if (env.ADMIN_PASSWORD) return await hashPassword(env.ADMIN_PASSWORD, 'env');
  const row = await db.get(env, "SELECT v FROM settings WHERE k = 'admin_hash'");
  const saltRow = await db.get(env, "SELECT v FROM settings WHERE k = 'admin_salt'");
  return row && saltRow ? row.v : null;
}

export async function checkAdminPassword(env, password) {
  const expected = await adminPasswordHash(env);
  if (!expected) return false;
  const salt = env.ADMIN_PASSWORD ? 'env' : (await db.get(env, "SELECT v FROM settings WHERE k = 'admin_salt'"))?.v || '';
  const candidate = await hashPassword(password, salt);
  return timingSafeEqual(candidate, expected);
}

export async function setAdminPassword(env, password) {
  const salt = randomId(12);
  const hash = await hashPassword(password, salt);
  await db.setSetting(env, 'admin_salt', salt);
  await db.setSetting(env, 'admin_hash', hash);
}

export async function verifyTurnstile(env, token, ip, cfg) {
  if (!cfg.turnstileSecret) return { ok: false, error: '未配置 Turnstile Secret' };
  const form = new FormData();
  form.set('secret', cfg.turnstileSecret);
  form.set('response', token);
  if (ip) form.set('remoteip', ip);
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: form,
  });
  const data = await res.json();
  return { ok: !!data.success, error: data['error-codes']?.join(',') || '' };
}
