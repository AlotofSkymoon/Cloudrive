// 通用工具函数
const enc = new TextEncoder();
const dec = new TextDecoder();

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  });
}

export function html(body, status = 200, headers = {}) {
  return new Response(body, {
    status,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', ...headers },
  });
}

export function text(body, status = 200, headers = {}) {
  return new Response(body, {
    status,
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store', ...headers },
  });
}

export function redirect(url, status = 302) {
  return new Response(null, { status, headers: { location: url, 'cache-control': 'no-store' } });
}

export function bufToHex(buf) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function sha256Hex(data) {
  const d = await crypto.subtle.digest('SHA-256', typeof data === 'string' ? enc.encode(data) : data);
  return bufToHex(d);
}

export async function hmacHex(secret, msg) {
  const key = await crypto.subtle.importKey(
    'raw',
    typeof secret === 'string' ? enc.encode(secret) : secret,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, typeof msg === 'string' ? enc.encode(msg) : msg);
  return bufToHex(sig);
}

export function b64urlEncode(input) {
  const bytes = typeof input === 'string' ? enc.encode(input) : input;
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function b64urlDecode(str) {
  const pad = str.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(pad + '==='.slice((pad.length + 3) % 4));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return dec.decode(bytes);
}

export function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

const ALPHABET = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function randomId(n = 10) {
  const a = new Uint8Array(n);
  crypto.getRandomValues(a);
  let s = '';
  for (const b of a) s += ALPHABET[b % ALPHABET.length];
  return s;
}

export function nowSec() {
  return Math.floor(Date.now() / 1000);
}

export function clientIp(request) {
  return (
    request.headers.get('cf-connecting-ip') ||
    (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() ||
    '0.0.0.0'
  );
}

export function clientCountry(request) {
  return request.headers.get('cf-ipcountry') || '';
}

export function safeName(name) {
  return (name || 'file')
    .replace(/[\\/:*?"<>|\r\n\t\x00]/g, '_')
    .replace(/^\.+/, '')
    .slice(0, 180) || 'file';
}

function encode5987(str) {
  return encodeURIComponent(str).replace(
    /['()*]/g,
    (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase()
  );
}

export function contentDisposition(name, inline = false) {
  const ascii = (name || 'file').replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '_');
  return `${inline ? 'inline' : 'attachment'}; filename="${ascii}"; filename*=UTF-8''${encode5987(name || 'file')}`;
}

export function fmtBytes(n) {
  const num = Number(n) || 0;
  if (num < 1024) return num + ' B';
  const units = ['KB', 'MB', 'GB', 'TB'];
  let v = num / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return v.toFixed(v >= 100 || i === 0 ? 0 : 1) + ' ' + units[i];
}

export function fmtTime(sec) {
  if (!sec) return '—';
  const d = new Date(sec * 1000);
  const p = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

// 解析 Range 头，返回 {offset, length}
export function parseRange(header, size) {
  if (!header) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m) return null;
  let start = m[1] === '' ? null : Number(m[1]);
  let end = m[2] === '' ? null : Number(m[2]);
  if (start === null && end === null) return null;
  if (start === null) {
    start = Math.max(0, size - end);
    end = size - 1;
  }
  if (end === null || end >= size) end = size - 1;
  if (start > end || start >= size) return null;
  return { offset: start, length: end - start + 1 };
}

export function buildKey(name, prefix = 'u') {
  const d = new Date();
  const p = (x) => String(x).padStart(2, '0');
  const dir = `${prefix}/${d.getFullYear()}/${p(d.getMonth() + 1)}`;
  const safe = safeName(name);
  return `${dir}/${randomId(12)}_${safe}`;
}
