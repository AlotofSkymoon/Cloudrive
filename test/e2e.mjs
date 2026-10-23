// 端到端冒烟测试（用本地模拟的 D1 / R2 跑完整流程）
import { FakeD1, FakeBucket } from './minid1.mjs';
import worker from '../src/index.js';

const env = {
  DB: new FakeD1(),
  BUCKET: new FakeBucket(),
  ADMIN_PASSWORD: 'test123',
  PUBLIC_BASE_URL: 'https://cdn.example.com',
  DOWNLOAD_MODE: 'auto',
  IP_MAX_DOWNLOADS: '100',
  R2_BUCKET_NAME: 's3pan',
};
const ctx = { waitUntil: (p) => Promise.resolve(p).catch(() => {}) };
// 简单 cookie jar：adm=后台会话，sp_xx=分享密码，ts_xx=人机验证
const jar = {};
const origin = 'https://pan.example.com';

function call(path, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  const parts = Object.values(jar).filter(Boolean);
  if (parts.length) headers.cookie = parts.join('; ');
  const req = new Request(origin + path, { ...opts, headers });
  return worker.fetch(req, env, ctx);
}
function grab(res) {
  const sc = res.headers.get('set-cookie');
  if (sc) {
    // 可能同时下发多个 cookie（unlock 会带密码 + 人机验证）
    for (const part of sc.split(/,\s*(?=[A-Za-z_][\w-]*=)/)) {
      const nv = part.split(';')[0].trim();
      const eq = nv.indexOf('=');
      if (eq > 0) jar[nv.slice(0, eq)] = nv;
    }
  }
  return res;
}
let failed = 0;
function assert(name, cond, extra = '') {
  console.log((cond ? '✅ ' : '❌ ') + name + (cond ? '' : ' → ' + extra));
  if (!cond) failed++;
}

// 1. 未登录 → 登录页
let r = await call('/');
let body = await r.text();
assert('未登录访问 / 返回登录页', body.includes('Filecove') && body.includes('管理员密码'));

// 1.5 状态探针：无需登录就能看出卡在哪
r = await call('/api/status');
let st = await r.json();
assert('状态探针显示已配置管理员密码', st.ok && st.hasAdmin === true && st.https === true, JSON.stringify(st));

// 2. 登录
r = grab(await call('/api/login', { method: 'POST', body: JSON.stringify({ password: 'wrong' }) }));
assert('错误密码登录失败', (await r.json()).ok === false);
r = grab(await call('/api/login', { method: 'POST', body: JSON.stringify({ password: 'test123' }) }));
assert('正确密码登录成功', (await r.json()).ok === true && (jar.adm || '').startsWith('adm='), jar.adm);

// 3. 后台
r = await call('/');
body = await r.text();
assert('已登录访问 / 返回管理后台', body.includes('文件') && body.includes('Filecove 管理'));

// 4. 上传（R2 绑定 → worker 模式）
r = await call('/api/upload/presign', {
  method: 'POST',
  body: JSON.stringify({ name: '你好 world.txt', size: 5, mime: 'text/plain' }),
});
const up = await r.json();
assert('获取上传凭证（worker 模式）', up.mode === 'worker' && !!up.fileId, JSON.stringify(up));

r = await call(up.url + '&x=0'.replace('&x=0', ''), {
  method: 'PUT',
  headers: { 'content-type': 'text/plain' },
  body: 'hello',
});
assert('PUT 上传成功', (await r.json()).ok === true);

r = await call('/api/files');
const files = (await r.json()).files;
assert('文件列表 1 个文件，大小已回写', files.length === 1 && files[0].size === 5, JSON.stringify(files));
const fileId = files[0].id;

// 5. 直链
r = await call(`/api/files/${fileId}/link`);
const link = await r.json();
assert('对象直链使用 PUBLIC_BASE_URL', link.url.startsWith('https://cdn.example.com/u/'), JSON.stringify(link));

// 6. 创建分享（密码 + 限 1 次）
r = await call('/api/shares', {
  method: 'POST',
  body: JSON.stringify({ file_id: fileId, password: 'abc', expires_in: 0, max_downloads: 1 }),
});
const sh = await r.json();
assert('创建分享成功', sh.ok && /^\/s\/[\w-]+$/.test(sh.url.replace(origin, '')), JSON.stringify(sh));
const code = sh.code;

// 7. 分享页
r = await call(`/s/${code}`);
body = await r.text();
assert('分享页渲染正常', body.includes('你好 world.txt') && body.includes('访问密码'));

// 8. 未输密码直接下载 → 跳回分享页（清掉访客 cookie，保留后台登录态）
for (const k of Object.keys(jar)) if (k !== 'adm') delete jar[k];
r = await call(`/d/${code}`);
assert('未验证密码下载被拦截', r.status === 302 && r.headers.get('location').includes('/s/' + code), r.headers.get('location'));

// 9. 密码校验
r = grab(await call(`/s/${code}/unlock`, { method: 'POST', body: JSON.stringify({ password: 'wrong' }) }));
assert('错误密码被拒绝', (await r.json()).ok === false);
r = grab(await call(`/s/${code}/unlock`, { method: 'POST', body: JSON.stringify({ password: 'abc' }) }));
assert('正确密码通过', (await r.json()).ok === true);

// 10. 下载（PUBLIC_BASE_URL 直链 → 302）
r = await call(`/d/${code}`);
assert('下载 302 到对象直链', r.status === 302 && r.headers.get('location').startsWith('https://cdn.example.com/'), r.headers.get('location'));

// 11. 次数上限
r = await call(`/d/${code}`);
body = await r.text();
assert('超过下载次数被拒绝', body.includes('下载次数已达上限'));

// 12. 强制代理下载（校验字节流）
r = await call(`/d/${code}?proxy=1`.replace('?proxy=1', ''), {}); // 已超限，改用 raw 预览前先重置次数
await env.DB.prepare('UPDATE shares SET downloads = 0 WHERE code = ?').bind(code).run();
r = await call(`/raw/${code}?proxy=1`);
const proxied = await r.text();
assert('Worker 代理下载返回文件内容', proxied === 'hello' && r.headers.get('content-disposition').includes('inline'), proxied.slice(0, 80));

// 13. direct 接口
r = await call(`/direct/${code}`);
const dl = await r.json();
assert('/direct 返回直链 JSON', dl.ok && dl.url.startsWith('https://cdn.example.com/'), JSON.stringify(dl));

// 14. 限流封禁
env.IP_MAX_DOWNLOADS = '1';
r = await call(`/d/${code}?proxy=1`.replace('?proxy=1', ''), {});
await env.DB.prepare('UPDATE shares SET downloads = 0, max_downloads = 0 WHERE code = ?').bind(code).run();
await call(`/d/${code}`);
r = await call(`/d/${code}`);
body = await r.text();
assert('单 IP 超限后被限流/封禁', body.includes('访问受限') || body.includes('频繁'), body.slice(0, 120));

// 14.5 桶内同步 / 搜索 / 分页
await env.BUCKET.put('sync-me.txt', 'abc');
const sy = await (await call('/api/sync', { method: 'POST', body: {} })).json();
assert('同步桶内已有对象进列表', sy.ok && sy.scanned >= 1 && sy.added === 1, JSON.stringify(sy));
let fl = (await (await call('/api/files?q=sync')).json()).files;
assert('按关键字搜索文件', fl.length === 1 && fl[0].name === 'sync-me.txt', JSON.stringify(fl.map((x) => x.name)));
const pg = await (await call('/api/files?limit=1')).json();
assert('列表分页给出下一页偏移', pg.files.length === 1 && pg.next === 1, JSON.stringify(pg.next));

// 15. 删除分享 + 文件
delete jar.adm;
r = grab(await call('/api/login', { method: 'POST', body: JSON.stringify({ password: 'test123' }) }));
await call('/api/shares/delete', { method: 'POST', body: JSON.stringify({ code }) });
const allIds = (await (await call('/api/files')).json()).files.map((f) => f.id);
await call('/api/files/delete', { method: 'POST', body: JSON.stringify({ ids: allIds }) });
r = await call('/api/files');
assert('删除文件后列表为空', (await r.json()).files.length === 0);
assert('存储对象一并删除', env.BUCKET.store.size === 0, String(env.BUCKET.store.size));

// 15.5 状态探针能区分「未登录 / 会话有效 / 会话无效」
r = await call('/api/status');
st = await r.json();
assert('带有效会话时探针显示 admin=true', st.admin === true && st.hasCookie === true && st.cookieState === 'valid', JSON.stringify(st));
// 直接发裸请求：上面的 call() 会自动带上 jar 里的有效 cookie
st = await (await worker.fetch(new Request(origin + '/api/status', { headers: { cookie: 'adm=not.a.valid.token' } }), env, ctx)).json();
assert('带无效 Cookie 时探针显示 invalid', st.admin === false && st.hasCookie === true && st.cookieState === 'invalid', JSON.stringify(st));
st = await (await worker.fetch(new Request(origin + '/api/status'), env, ctx)).json();
assert('不带 Cookie 时探针显示 none', st.admin === false && st.hasCookie === false && st.cookieState === 'none', JSON.stringify(st));

// 16. 未配置管理员密码时，登录应明确提示（不是笼统的「密码错误」）
const env2 = { ...env, ADMIN_PASSWORD: '', DB: new FakeD1() };
env2.DB = new FakeD1();
const call2 = (path, opts = {}) =>
  worker.fetch(new Request(origin + path, { ...opts, headers: { ...(opts.headers || {}) } }), env2, ctx);
let r2 = await call2('/api/status');
assert('未配置密码时探针如实上报', (await r2.json()).hasAdmin === false);
r2 = await call2('/api/login', { method: 'POST', body: JSON.stringify({ password: 'whatever' }) });
const bad = await r2.json();
assert('未配置密码时登录给出原因', bad.ok === false && bad.reason === 'no_password', JSON.stringify(bad));
assert('未配置密码时不下发会话 Cookie', !r2.headers.get('set-cookie'));

// 16.5 密码首尾带空白（从控制台复制时很容易带上）也能登录成功
const env3 = { ...env, ADMIN_PASSWORD: '  test123\n', DB: new FakeD1() };
const call3 = (path, opts = {}) =>
  worker.fetch(new Request(origin + path, { ...opts, headers: { ...(opts.headers || {}) } }), env3, ctx);
r = await call3('/api/login', { method: 'POST', body: JSON.stringify({ password: 'test123' }) });
let body3 = await r.text();
assert('密码含首尾空白时仍可登录', JSON.parse(body3).ok === true, body3);
r = await call3('/api/login', { method: 'POST', body: JSON.stringify({ password: '  test123  ' }) });
assert('输入侧带空白也能登录', (await r.json()).ok === true);
r = await call3('/api/login', { method: 'POST', body: JSON.stringify({ password: 'wrong' }) });
const shape = await r.json();
assert('密码错误时给出密码形态提示', shape.ok === false && shape.hint && shape.hint.hasLeadingTrailingSpace === true, JSON.stringify(shape));

// 17. HTTP 访问时不加 Secure，避免浏览器丢弃 Cookie
const httpRes = await worker.fetch(
  new Request('http://pan.example.com/api/login', { method: 'POST', body: JSON.stringify({ password: 'test123' }) }),
  env,
  ctx
);
const httpCookie = httpRes.headers.get('set-cookie') || '';
assert('HTTP 下发的 Cookie 不带 Secure', httpCookie && !/Secure/i.test(httpCookie), httpCookie);

console.log(failed ? `\n❌ ${failed} 项失败` : '\n🎉 全部通过');
process.exit(failed ? 1 : 0);
