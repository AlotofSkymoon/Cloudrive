// 路由入口：管理后台 API + 上传 + 分享管理
import * as db from './db.js';
import * as auth from './auth.js';
import * as limit from './limit.js';
import { createStorage } from './storage.js';
import { adminHtml, loginHtml, renderErrorPage } from './ui.js';
import { sharePage, unlock, doDownload, directLink } from './share.js';
import {
  json,
  html,
  text,
  redirect,
  randomId,
  nowSec,
  clientIp,
  clientCountry,
  safeName,
  buildKey,
  fmtBytes,
} from './util.js';

const ADMIN_PREFIX = '/api/';

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'access-control-allow-origin': '*',
          'access-control-allow-methods': 'GET,POST,PUT,DELETE,HEAD,OPTIONS',
          'access-control-allow-headers': '*',
          'access-control-max-age': '86400',
        },
      });
    }

    await db.init(env);
    let storage;
    try {
      storage = createStorage(env);
    } catch (e) {
      return renderErrorPage('存储未配置', String(e.message || e) + '。请绑定 R2 存储桶或配置 S3_* 变量。');
    }
    const cfg = await db.config(env);
    const url = new URL(request.url);
    const p = url.pathname.replace(/\/+$/, '') || '/';
    const method = request.method;

    // ---------- 静态页面 ----------
    if (p === '/' || p === '/index.html') {
      if (!(await auth.isAdmin(request, env))) return html(loginHtml());
      return html(
        adminHtml({
          driver: storage.driver === 'r2' ? 'R2 绑定' : 'S3 兼容',
          bucket: storage.label || '-',
        })
      );
    }
    if (p === '/favicon.ico') return new Response(null, { status: 204 });

    // ---------- 登录 / 登出 ----------
    if (p === '/api/login' && method === 'POST') {
      let body = {};
      try {
        body = await request.json();
      } catch {}
      const ok = await auth.checkAdminPassword(env, String(body.password || ''));
      if (!ok) return json({ ok: false, msg: (!env.ADMIN_PASSWORD && !(await db.get(env, "SELECT v FROM settings WHERE k='admin_hash'"))) ? '尚未设置管理员密码，请在 Cloudflare 添加变量 ADMIN_PASSWORD' : '密码错误' }, 401);
      const token = await auth.signToken(env, { role: 'admin' }, 60 * 60 * 12);
      return json({ ok: true }, 200, { 'Set-Cookie': auth.cookieHeader('adm', token) });
    }
    if (p === '/api/logout' && method === 'POST') {
      return json({ ok: true }, 200, { 'Set-Cookie': auth.clearCookie('adm') });
    }

    // ---------- 公开路由 ----------
    let m;
    if ((m = /^\/s\/([\w-]{4,32})$/.exec(p))) {
      return sharePage(request, env, ctx, storage, cfg, m[1]);
    }
    if ((m = /^\/s\/([\w-]{4,32})\/unlock$/.exec(p)) && method === 'POST') {
      return unlock(request, env, ctx, storage, cfg, m[1]);
    }
    if ((m = /^\/d\/([\w-]{4,32})$/.exec(p))) {
      return doDownload(request, env, ctx, storage, cfg, m[1], { inline: false });
    }
    if ((m = /^\/raw\/([\w-]{4,32})$/.exec(p))) {
      return doDownload(request, env, ctx, storage, cfg, m[1], { inline: true });
    }
    if ((m = /^\/direct\/([\w-]{4,32})$/.exec(p))) {
      return directLink(request, env, ctx, storage, cfg, m[1]);
    }

    // ---------- 管理 API ----------
    if (p.startsWith(ADMIN_PREFIX)) {
      if (!(await auth.isAdmin(request, env))) return json({ ok: false, msg: '未登录' }, 401);
      return await adminApi(request, env, ctx, storage, cfg, p, method, url);
    }

    return renderErrorPage('404', '页面不存在：' + p);
  },
};

async function adminApi(request, env, ctx, storage, cfg, p, method, url) {
  let m;
  const body = async () => {
    try {
      return await request.json();
    } catch {
      return {};
    }
  };

  // 文件列表（支持关键字搜索 + 游标分页）
  if (p === '/api/files' && method === 'GET') {
    const q = (url.searchParams.get('q') || '').trim();
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 100, 1), 200);
    const offset = Math.max(Number(url.searchParams.get('offset')) || 0, 0);
    const args = [];
    const where = q ? ' WHERE name LIKE ?' : '';
    if (q) args.push(`%${q}%`);
    const files = await db.all(env, `SELECT * FROM files${where} ORDER BY uploaded_at DESC LIMIT ? OFFSET ?`, ...args, limit + 1, offset);
    const hasMore = files.length > limit;
    if (hasMore) files.pop();
    return json({ ok: true, files, next: hasMore ? offset + limit : null });
  }

  // 同步存储桶里已有的对象到数据库（换桶 / 手动往桶里传了文件时用）
  if (p === '/api/sync' && method === 'POST') {
    const objects = await storage.list(2000).catch(() => []);
    let added = 0;
    for (const o of objects) {
      const row = await db.get(env, 'SELECT id FROM files WHERE key = ?', o.key);
      if (row) continue;
      const name = String(o.key).split('/').pop() || o.key;
      await db.run(
        env,
        'INSERT INTO files (id, key, name, size, mime, uploaded_at, ip) VALUES (?, ?, ?, ?, ?, ?, ?)',
        randomId(16),
        o.key,
        safeName(name),
        o.size || 0,
        '',
        o.uploaded || nowSec(),
        'sync'
      );
      added++;
    }
    await db.run(env, "INSERT INTO logs (ts, action, code, file_id, ip, country, ua, bytes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", nowSec(), 'sync', '', '', clientIp(request), clientCountry(request), 'bucket-sync', added).catch(() => {});
    return json({ ok: true, scanned: objects.length, added });
  }

  // 上传凭证
  if (p === '/api/upload/presign' && method === 'POST') {
    const b = await body();
    const name = safeName(b.name || 'file');
    const size = Number(b.size) || 0;
    const mime = b.mime || 'application/octet-stream';
    if (cfg.uploadMaxSize && size > cfg.uploadMaxSize) {
      return json({ ok: false, msg: '文件超过大小上限 ' + fmtBytes(cfg.uploadMaxSize) }, 413);
    }
    const key = buildKey(name);
    const id = randomId(16);
    await db.run(
      env,
      'INSERT INTO files (id, key, name, size, mime, uploaded_at, ip) VALUES (?, ?, ?, ?, ?, ?, ?)',
      id,
      key,
      name,
      size,
      mime,
      nowSec(),
      clientIp(request)
    );
    if (storage.canPresign) {
      if (size > cfg.multipartThreshold) {
        let partSize = Math.max(cfg.multipartPartSize, Math.ceil(size / 10000 / 1024 / 1024) * 1024 * 1024);
        const partCount = Math.ceil(size / partSize);
        const uploadId = await storage.createMultipart(key, mime);
        const urls = [];
        for (let i = 1; i <= partCount; i++) urls.push(await storage.presignPart(key, uploadId, i, 3600 * 6));
        return json({ ok: true, mode: 'multipart', fileId: id, key, uploadId, partSize, urls });
      }
      const putUrl = await storage.presignPut(key, { contentType: mime, expires: 3600 });
      return json({ ok: true, mode: 'direct', fileId: id, key, url: putUrl });
    }
    return json({ ok: true, mode: 'worker', fileId: id, key, url: `/api/upload/raw?fileId=${id}` });
  }

  // Worker 直传（R2 绑定模式）
  if (p === '/api/upload/raw' && method === 'PUT') {
    const id = url.searchParams.get('fileId');
    const row = await db.get(env, 'SELECT * FROM files WHERE id = ?', id);
    if (!row) return json({ ok: false, msg: '文件记录不存在' }, 404);
    const mime = request.headers.get('content-type') || row.mime;
    await storage.put(row.key, request.body, { contentType: mime });
    const head = await storage.head(row.key);
    await db.run(env, 'UPDATE files SET size = ?, mime = ? WHERE id = ?', head?.size || row.size, mime, id);
    return json({ ok: true });
  }
  if (p === '/api/upload/confirm' && method === 'POST') {
    const b = await body();
    await db.run(env, 'UPDATE files SET size = ? WHERE id = ?', Number(b.size) || 0, b.fileId);
    return json({ ok: true });
  }
  if (p === '/api/upload/multipart/complete' && method === 'POST') {
    const b = await body();
    await storage.completeMultipart(b.key, b.uploadId, b.parts || []);
    const head = await storage.head(b.key);
    if (head) await db.run(env, 'UPDATE files SET size = ? WHERE key = ?', head.size, b.key);
    return json({ ok: true });
  }
  if (p === '/api/upload/multipart/abort' && method === 'POST') {
    const b = await body();
    await storage.abortMultipart(b.key, b.uploadId);
    await db.run(env, 'DELETE FROM files WHERE key = ?', b.key);
    return json({ ok: true });
  }

  // 删除文件（连带删除存储对象与分享）
  if (p === '/api/files/delete' && method === 'POST') {
    const b = await body();
    const ids = (b.ids || []).filter(Boolean);
    for (const id of ids) {
      const row = await db.get(env, 'SELECT * FROM files WHERE id = ?', id);
      if (!row) continue;
      await storage.delete(row.key).catch(() => {});
      await db.run(env, 'DELETE FROM shares WHERE file_id = ?', id);
      await db.run(env, 'DELETE FROM files WHERE id = ?', id);
    }
    return json({ ok: true });
  }

  // 对象直链
  if ((m = /^\/api\/files\/([\w-]{8,32})\/link$/.exec(p)) && method === 'GET') {
    const row = await db.get(env, 'SELECT * FROM files WHERE id = ?', m[1]);
    if (!row) return json({ ok: false, msg: '文件不存在' }, 404);
    const pub = storage.publicUrl ? storage.publicUrl(row.key) : null;
    if (pub) return json({ ok: true, url: pub });
    if (storage.presignGet) {
      return json({ ok: true, url: await storage.presignGet(row.key, { expires: 3600, filename: row.name, download: true }), signed: true });
    }
    return json({ ok: true, url: null, msg: '未配置 PUBLIC_BASE_URL' });
  }

  // 分享：创建 / 列表 / 删除 / 修改
  if (p === '/api/shares' && method === 'POST') {
    const b = await body();
    const file = await db.get(env, 'SELECT * FROM files WHERE id = ?', b.file_id);
    if (!file) return json({ ok: false, msg: '文件不存在' }, 404);
    let code = randomId(8);
    for (let i = 0; i < 5; i++) {
      const exists = await db.get(env, 'SELECT code FROM shares WHERE code = ?', code);
      if (!exists) break;
      code = randomId(8);
    }
    const salt = randomId(12);
    const hash = b.password ? await auth.hashPassword(String(b.password), salt) : null;
    const expiresAt = Number(b.expires_in) > 0 ? nowSec() + Number(b.expires_in) : 0;
    await db.run(
      env,
      'INSERT INTO shares (code, file_id, password_hash, salt, expires_at, max_downloads, downloads, traffic, show_name, created_at) VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?, ?)',
      code,
      file.id,
      hash,
      salt,
      expiresAt,
      Number(b.max_downloads) || 0,
      b.show_name === false ? 0 : 1,
      nowSec()
    );
    return json({ ok: true, code, url: `${url.origin}/s/${code}` });
  }
  if (p === '/api/shares' && method === 'GET') {
    const rows = await db.all(
      env,
      `SELECT s.*, f.name FROM shares s JOIN files f ON f.id = s.file_id ORDER BY s.created_at DESC LIMIT 300`
    );
    const shares = rows.map((r) => ({ ...r, url: `${url.origin}/s/${r.code}` }));
    return json({ ok: true, shares });
  }
  if (p === '/api/shares/delete' && method === 'POST') {
    const b = await body();
    await db.run(env, 'DELETE FROM shares WHERE code = ?', b.code);
    return json({ ok: true });
  }
  if (p === '/api/shares/update' && method === 'POST') {
    const b = await body();
    const sets = [];
    const args = [];
    if (b.disabled != null) {
      sets.push('disabled = ?');
      args.push(b.disabled ? 1 : 0);
    }
    if (b.password != null) {
      const salt = randomId(12);
      sets.push('password_hash = ?, salt = ?');
      args.push(b.password ? await auth.hashPassword(String(b.password), salt) : null, salt);
    }
    if (b.expires_in != null) {
      sets.push('expires_at = ?');
      args.push(Number(b.expires_in) > 0 ? nowSec() + Number(b.expires_in) : 0);
    }
    if (b.max_downloads != null) {
      sets.push('max_downloads = ?');
      args.push(Number(b.max_downloads) || 0);
    }
    if (!sets.length) return json({ ok: false, msg: '没有要修改的字段' }, 400);
    await db.run(env, `UPDATE shares SET ${sets.join(', ')} WHERE code = ?`, ...args, b.code);
    return json({ ok: true });
  }

  // 日志 / 封禁
  if (p === '/api/logs' && method === 'GET') {
    const rows = await db.all(
      env,
      `SELECT l.*, f.name FROM logs l LEFT JOIN files f ON f.id = l.file_id ORDER BY l.ts DESC LIMIT 200`
    );
    return json({ ok: true, logs: rows });
  }
  if (p === '/api/bans' && method === 'GET') {
    return json({ ok: true, bans: await limit.listBans(env) });
  }
  if (p === '/api/bans' && method === 'POST') {
    const b = await body();
    const until = await limit.banIp(env, String(b.ip), b.reason || '管理员手动封禁', Number(b.minutes) || 60);
    return json({ ok: true, until });
  }
  if (p === '/api/bans/unban' && method === 'POST') {
    const b = await body();
    await limit.unbanIp(env, String(b.ip));
    return json({ ok: true });
  }

  // 统计
  if (p === '/api/stats' && method === 'GET') {
    const f = await db.get(env, 'SELECT COUNT(*) AS c FROM files');
    const s = await db.get(env, 'SELECT COUNT(*) AS c FROM shares');
    const d = await db.get(env, "SELECT COUNT(*) AS c FROM logs WHERE action = 'download'");
    const traffic = await limit.monthlyTraffic(env);
    return json({
      ok: true,
      files: f?.c || 0,
      shares: s?.c || 0,
      downloads: d?.c || 0,
      traffic,
      limit: cfg.monthlyTrafficLimit,
    });
  }

  // 配置读写
  if (p === '/api/config' && method === 'GET') {
    return json({ ok: true, config: cfg, hasEnvAdmin: !!env.ADMIN_PASSWORD });
  }
  if (p === '/api/config' && method === 'POST') {
    const b = await body();
    const map = {
      PUBLIC_BASE_URL: b.publicBaseUrl,
      DOWNLOAD_MODE: b.downloadMode,
      IP_MAX_DOWNLOADS: b.ipMaxDownloads,
      BAN_MINUTES: b.banMinutes,
      MONTHLY_TRAFFIC_LIMIT: b.monthlyTrafficLimit,
      TURNSTILE_SITEKEY: b.turnstileSitekey,
      TURNSTILE_SECRET: b.turnstileSecret,
      TURNSTILE_ENABLED: b.turnstileEnabled ? '1' : '0',
    };
    for (const [k, v] of Object.entries(map)) {
      if (v != null) await db.setSetting(env, k, v);
    }
    let pwdMsg = '';
    if (b.adminPassword) {
      if (env.ADMIN_PASSWORD) pwdMsg = '（环境变量 ADMIN_PASSWORD 优先级更高，UI 修改未生效）';
      else await auth.setAdminPassword(env, String(b.adminPassword));
    }
    return json({ ok: true, msg: '已保存' + pwdMsg });
  }

  return json({ ok: false, msg: '未知接口' }, 404);
}
