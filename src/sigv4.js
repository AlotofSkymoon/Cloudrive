// AWS Signature V4 签名（纯 WebCrypto，无依赖），用于任意 S3 兼容存储
const enc = new TextEncoder();

export function bufToHex(buf) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function sha256Hex(data) {
  const d = await crypto.subtle.digest('SHA-256', typeof data === 'string' ? enc.encode(data) : data);
  return bufToHex(d);
}

async function hmac(key, msg) {
  const k = await crypto.subtle.importKey(
    'raw',
    typeof key === 'string' ? enc.encode(key) : key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, typeof msg === 'string' ? enc.encode(msg) : msg));
}

// 严格 URI 编码（AWS 规范），路径中的 / 默认保留
export function uriEncode(str, encodeSlash = false) {
  let out = '';
  for (const ch of String(str)) {
    const c = ch.charCodeAt(0);
    const isUnreserved =
      (c >= 65 && c <= 90) || (c >= 97 && c <= 122) || (c >= 48 && c <= 57) || ch === '-' || ch === '.' || ch === '_' || ch === '~';
    if (isUnreserved) out += ch;
    else if (ch === '/') out += encodeSlash ? '%2F' : '/';
    else {
      const bytes = enc.encode(ch);
      for (const b of bytes) out += '%' + b.toString(16).toUpperCase().padStart(2, '0');
    }
  }
  return out;
}

export function canonicalQuery(params = {}) {
  return Object.entries(params)
    .map(([k, v]) => [uriEncode(k, true), uriEncode(v == null ? '' : String(v), true)])
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');
}

function amzNow(d = new Date()) {
  return {
    amzDate: d.toISOString().replace(/[:-]|\.\d{3}/g, ''),
    dateStamp: d.toISOString().slice(0, 10).replace(/-/g, ''),
  };
}

async function signingKey(secret, dateStamp, region, service = 's3') {
  const kDate = await hmac('AWS4' + secret, dateStamp);
  const kRegion = await hmac(kDate, region);
  const kService = await hmac(kRegion, service);
  return await hmac(kService, 'aws4_request');
}

// 预签名 URL（query 方式），payload 固定 UNSIGNED-PAYLOAD
export async function presign(cfg, { method = 'GET', url, query = {}, headers = {}, expires = 900, now = new Date() }) {
  const u = new URL(url);
  const { amzDate, dateStamp } = amzNow(now);
  const scope = `${dateStamp}/${cfg.region}/s3/aws4_request`;
  const lower = Object.keys(headers).map((k) => k.toLowerCase()).sort();
  const signedHeaders = ['host', ...lower].join(';');
  const q = {
    ...query,
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${cfg.accessKeyId}/${scope}`,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': String(expires),
    'X-Amz-SignedHeaders': signedHeaders,
  };
  if (cfg.sessionToken) q['X-Amz-Security-Token'] = cfg.sessionToken;
  const cq = canonicalQuery(q);
  const canonicalHeaders =
    `host:${u.host}\n` + lower.map((k) => `${k}:${String(headers[k]).trim()}\n`).join('');
  const canonicalRequest = [method, u.pathname, cq, canonicalHeaders, signedHeaders, 'UNSIGNED-PAYLOAD'].join('\n');
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, await sha256Hex(canonicalRequest)].join('\n');
  const key = await signingKey(cfg.secretAccessKey, dateStamp, cfg.region);
  const signature = bufToHex(await hmac(key, stringToSign));
  return `${u.origin}${u.pathname}?${cq}&X-Amz-Signature=${signature}`;
}

// 请求头签名，用于服务端直接调用 S3 API（multipart 等）
export async function signRequest(cfg, { method = 'GET', url, headers = {}, body = null, now = new Date() }) {
  const u = new URL(url);
  const { amzDate, dateStamp } = amzNow(now);
  const payloadHash = await sha256Hex(body == null ? '' : body);
  const h = {};
  for (const [k, v] of Object.entries(headers)) h[k.toLowerCase()] = v;
  h['host'] = u.host;
  h['x-amz-content-sha256'] = payloadHash;
  h['x-amz-date'] = amzDate;
  if (cfg.sessionToken) h['x-amz-security-token'] = cfg.sessionToken;

  const signedHeaders = Object.keys(h).sort();
  const canonicalHeaders = signedHeaders.map((k) => `${k}:${String(h[k]).trim()}\n`).join('');
  const canonicalRequest = [
    method,
    u.pathname,
    canonicalQuery(Object.fromEntries(u.searchParams.entries())),
    canonicalHeaders,
    signedHeaders.join(';'),
    payloadHash,
  ].join('\n');
  const scope = `${dateStamp}/${cfg.region}/s3/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, await sha256Hex(canonicalRequest)].join('\n');
  const key = await signingKey(cfg.secretAccessKey, dateStamp, cfg.region);
  const signature = bufToHex(await hmac(key, stringToSign));
  h['authorization'] =
    `AWS4-HMAC-SHA256 Credential=${cfg.accessKeyId}/${scope}, SignedHeaders=${signedHeaders.join(';')}, Signature=${signature}`;
  return h;
}

export async function signedFetch(cfg, url, opts = {}) {
  const { method = 'GET', headers = {}, body = null } = opts;
  const signed = await signRequest(cfg, { method, url, headers, body });
  return fetch(url, { method, headers: signed, body });
}
