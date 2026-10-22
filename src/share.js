// 公开访问：分享页 / 下载直链 / 密码与人机校验
import * as db from './db.js';
import * as limit from './limit.js';
import * as auth from './auth.js';
import { shareHtml, renderErrorPage } from './ui.js';
import {
  json,
  html,
  text,
  redirect,
  nowSec,
  clientIp,
  clientCountry,
  contentDisposition,
  parseRange,
  fmtBytes,
} from './util.js';

async function loadShare(env, code) {
  return await db.get(
    env,
    `SELECT s.*, f.key AS file_key, f.name AS file_name, f.size AS file_size, f.mime AS file_mime
     FROM shares s JOIN files f ON f.id = s.file_id
     WHERE s.code = ?`,
    code
  );
}

function checkExpired(share) {
  if (share.disabled) return '该分享已被关闭';
  if (share.expires_at && nowSec() > share.expires_at) return '分享已过期';
  if (share.max_downloads && share.downloads >= share.max_downloads) return '下载次数已达上限';
  return null;
}

async function ipGuard(env, request, cfg) {
  const ip = clientIp(request);
  const ban = await limit.isBanned(env, ip);
  if (ban) return { error: `你的 IP 因「${ban.reason || '异常访问'}」被限制访问`, until: ban.until };
  const used = await limit.ipDownloadCount(env, ip, cfg.ipWindowSec);
  if (used >= cfg.ipMaxDownloads) {
    const until = await limit.banIp(env, ip, `单位时间内下载次数超限（${used} 次）`, cfg.banMinutes);
    return { error: '访问过于频繁，IP 已被临时限制', until };
  }
  return null;
}

async function trafficGuard(env, cfg) {
  if (!cfg.monthlyTrafficLimit) return null;
  const used = await limit.monthlyTraffic(env);
  if (used >= cfg.monthlyTrafficLimit) return { error: '本月流量配额已用尽' };
  return null;
}

// GET /s/:code 分享页面
export async function sharePage(request, env, ctx, storage, cfg, code) {
  const share = await loadShare(env, code);
  if (!share) return renderErrorPage('链接不存在', '这个分享链接无效或已被删除。');
  const err = checkExpired(share);
  const ip = clientIp(request);
  const ban = await limit.isBanned(env, ip);
  const verifiedPwd = !share.password_hash || !!(await auth.verifyToken(env, auth.readCookie(request, `sp_${code}`)));
  const verifiedTurnstile = !cfg.turnstileEnabled || !!(await auth.verifyToken(env, auth.readCookie(request, `ts_${code}`)));

  return html(
    shareHtml({
      code,
      share,
      error: err,
      banned: !!ban,
      banUntil: ban?.until || 0,
      needPassword: !verifiedPwd,
      needTurnstile: cfg.turnstileEnabled && !verifiedTurnstile,
      turnstileSitekey: cfg.turnstileSitekey,
      origin: new URL(request.url).origin,
    })
  );
}

// POST /s/:code/unlock 校验密码 / Turnstile，通过后下发短期 Cookie
export async function unlock(request, env, ctx, storage, cfg, code) {
  const share = await loadShare(env, code);
  if (!share) return json({ ok: false, msg: '链接不存在' }, 404);
  const err = checkExpired(share);
  if (err) return json({ ok: false, msg: err }, 403);

  let body = {};
  try {
    body = await request.json();
  } catch {}

  const cookies = [];
  if (share.password_hash) {
    const pwd = String(body.password || '');
    const hash = await auth.hashPassword(pwd, share.salt || '');
    if (hash !== share.password_hash) return json({ ok: false, msg: '访问密码错误' }, 401);
    cookies.push(auth.cookieHeader(`sp_${code}`, await auth.signToken(env, { c: code, t: 'pwd' }, 3600 * 6)));
  }

  if (cfg.turnstileEnabled) {
    const token = String(body.turnstile || '');
    if (!token) return json({ ok: false, msg: '请先完成人机验证' }, 401);
    const res = await auth.verifyTurnstile(env, token, clientIp(request), cfg);
    if (!res.ok) return json({ ok: false, msg: '人机验证未通过：' + res.error }, 401);
    cookies.push(auth.cookieHeader(`ts_${code}`, await auth.signToken(env, { c: code, t: 'ts' }, 1800)));
  }

  const headers = {};
  if (cookies.length) headers['Set-Cookie'] = cookies.join(', ');
  return json({ ok: true, url: `/d/${code}` }, 200, headers);
}

// GET /d/:code（附件下载）/ GET /raw/:code（在线预览）—— 最终都 302 到存储直链
export async function doDownload(request, env, ctx, storage, cfg, code, { inline = false } = {}) {
  const share = await loadShare(env, code);
  if (!share) return renderErrorPage('链接不存在', '这个分享链接无效或已被删除。');

  const ip = clientIp(request);
  const ban = await limit.isBanned(env, ip);
  if (ban) return renderErrorPage('访问受限', `你的 IP 已被临时限制，请稍后再试。`);

  const err = checkExpired(share);
  if (err) return renderErrorPage('无法下载', err);

  if (share.password_hash) {
    const token = auth.readCookie(request, `sp_${code}`);
    const data = await auth.verifyToken(env, token);
    if (!data || data.c !== code) return redirectTo(request, `/s/${code}?need=pwd`, 302);
  }
  if (cfg.turnstileEnabled) {
    const data = await auth.verifyToken(env, auth.readCookie(request, `ts_${code}`));
    if (!data || data.c !== code) return redirectTo(request, `/s/${code}?need=ts`, 302);
  }
  const rateErr = await ipGuard(env, request, cfg);
  if (rateErr) return renderErrorPage('访问受限', rateErr.error);
  const trafficErr = await trafficGuard(env, cfg);
  if (trafficErr) return renderErrorPage('流量超限', trafficErr.error);

  const size = Number(share.file_size) || 0;
  // 计次（超过上限时不会写入）
  await db.run(
    env,
    'UPDATE shares SET downloads = downloads + 1, traffic = traffic + ?, last_at = ? WHERE code = ? AND (max_downloads = 0 OR downloads < max_downloads)',
    size,
    nowSec(),
    code
  );
  ctx.waitUntil(
    db
      .run(
        env,
        'INSERT INTO logs (ts, action, code, file_id, ip, country, ua, bytes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        nowSec(),
        'download',
        code,
        share.file_id,
        ip,
        clientCountry(request),
        (request.headers.get('user-agent') || '').slice(0, 200),
        size
      )
      .catch(() => {})
  );
  ctx.waitUntil(limit.monthlyTraffic(env, size).catch(() => {}));

  // —— 直链优先：302 到对象存储本身，不占 Worker 流量 ——
  const mode = cfg.downloadMode;
  const publicUrl = storage.publicUrl ? storage.publicUrl(share.file_key) : null;
  const wantName = contentDisposition(share.file_name, inline);
  const url = new URL(request.url);
  const forceProxy = url.searchParams.get('proxy') === '1';

  if (!forceProxy && (mode === 'public' || (mode === 'auto' && publicUrl))) {
    if (publicUrl) return redirect(publicUrl);
  }
  if (!forceProxy && (mode === 'signed' || mode === 'auto') && storage.presignGet) {
    const signed = await storage.presignGet(share.file_key, {
      expires: 900,
      filename: share.file_name,
      download: !inline,
    });
    if (signed) return redirect(signed);
  }
  // 兜底：Worker 代理流式下载（会消耗 Worker 流量）
  return await proxyDownload(request, env, storage, share, inline, wantName);
}

function redirectTo(request, path, status = 302) {
  const u = new URL(request.url);
  return redirect(`${u.origin}${path}`, status);
}

async function proxyDownload(request, env, storage, share, inline, disposition) {
  const rangeHeader = request.headers.get('range');
  const range = rangeHeader ? parseRange(rangeHeader, Number(share.file_size) || 0) : null;
  const obj = await storage.get(share.file_key, range);
  if (!obj) return renderErrorPage('文件不存在', '对象已被删除或存储配置有误。');
  const headers = new Headers();
  headers.set('content-type', share.file_mime || obj.contentType || 'application/octet-stream');
  headers.set('content-disposition', disposition);
  headers.set('accept-ranges', 'bytes');
  headers.set('cache-control', 'private, max-age=0');
  if (obj.etag) headers.set('etag', obj.etag);
  if (range) {
    headers.set('content-range', `bytes ${range.offset}-${range.offset + range.length - 1}/${share.file_size}`);
    headers.set('content-length', String(range.length));
    return new Response(obj.body, { status: 206, headers });
  }
  if (obj.size) headers.set('content-length', String(obj.size));
  else if (!range && share.file_size) headers.set('content-length', String(share.file_size));
  return new Response(obj.body, { status: 200, headers });
}

// GET /direct/:code 返回纯直链地址（JSON），方便程序调用
export async function directLink(request, env, ctx, storage, cfg, code) {
  const share = await loadShare(env, code);
  if (!share) return json({ ok: false, msg: '链接不存在' }, 404);
  const publicUrl = storage.publicUrl ? storage.publicUrl(share.file_key) : null;
  if (publicUrl) return json({ ok: true, url: publicUrl, name: share.file_name, size: share.file_size });
  if (storage.presignGet) {
    const signed = await storage.presignGet(share.file_key, { expires: 900, filename: share.file_name, download: true });
    return json({ ok: true, url: signed, name: share.file_name, size: share.file_size });
  }
  const u = new URL(request.url);
  return json({ ok: true, url: `${u.origin}/d/${code}`, name: share.file_name, size: share.file_size, proxied: true });
}

export { fmtBytes };
