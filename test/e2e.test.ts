// 端到端冒烟测试（用本地模拟的 D1 / R2 跑完整流程）
import { test, expect } from 'vitest';
import { FakeD1, FakeBucket } from './minid1';
import worker from '../src/index';

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
{
  const boot = /window\.__FILECOVE__=(\{[\s\S]*?\});<\/script>/.exec(body);
  assert('未登录访问 / 返回登录页', !!boot && JSON.parse(boot[1]).view === 'login', body.slice(0, 120));
  // 登录页还要带上状态探针，才能提示「没设密码 / HTTP 访问」
  assert('登录页注入了状态探针', !!boot && !!JSON.parse(boot[1]).status, '缺少 status');
}

// 1.5 状态探针：无需登录就能看出卡在哪
r = await call('/api/status');
let st = await r.json();
assert('状态探针显示已配置管理员密码', st.ok && st.hasAdmin === true && st.https === true, JSON.stringify(st));

// 1.6 页面外壳不该再内联 onsubmit
// （以前内联 `return login()` 时，async 返回 Promise 属真值，挡不住表单默认提交，
//   浏览器原生导航会把 /api/login 掐断，表现为「刷新后又回到登录页」。
//   现在前端由 Vue 渲染，用 @submit.prevent，外壳里不该出现内联事件属性）
{
  const page = await (await worker.fetch(new Request(origin + '/'), env, ctx)).text();
  assert('页面外壳不含内联 onsubmit', !/onsubmit\s*=/.test(page), '出现了内联 onsubmit');
  assert('页面外壳不含内联 onclick', !/onclick\s*=/.test(page), '出现了内联 onclick');
}

// 2. 登录
r = grab(await call('/api/login', { method: 'POST', body: JSON.stringify({ password: 'wrong' }) }));
assert('错误密码登录失败', (await r.json()).ok === false);
r = grab(await call('/api/login', { method: 'POST', body: JSON.stringify({ password: 'test123' }) }));
assert('正确密码登录成功', (await r.json()).ok === true && (jar.adm || '').startsWith('adm='), jar.adm);

// 3. 后台
r = await call('/');
body = await r.text();
{
  const boot = /window\.__FILECOVE__=(\{[\s\S]*?\});<\/script>/.exec(body);
  const b = boot ? JSON.parse(boot[1]) : null;
  assert('已登录访问 / 返回管理后台', !!b && b.view === 'admin', body.slice(0, 120));
  assert('后台页带上了存储信息', !!b && !!b.driver && !!b.bucket, JSON.stringify(b));
}

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

// 5.5 直链域名只填裸域名时也要拼成绝对地址
// （否则浏览器按当前路径解析成 /d/v6.cc.cd/... 这类不存在的路径，直接 404）
{
  // DB 复用同一个实例，这样能查到刚上传的文件
  const envBare = { ...env, PUBLIC_BASE_URL: 'v6.cc.cd' };
  const cookieStr = Object.values(jar).filter(Boolean).join('; ');
  const callBare = (path, opts = {}) =>
    worker.fetch(new Request(origin + path, { ...opts, headers: { ...(opts.headers || {}), cookie: cookieStr } }), envBare, ctx);
  const bareLink = await (await callBare(`/api/files/${fileId}/link`)).json();
  assert('裸域名直链自动补 https', /^https:\/\/v6\.cc\.cd\//.test(bareLink.url), JSON.stringify(bareLink));
}

// 5.6 图片预览接口：已登录可访问，未登录 401
{
  const cookieStr2 = Object.values(jar).filter(Boolean).join('; ');
  const prev = await worker.fetch(new Request(origin + `/preview/${fileId}`, { headers: { cookie: cookieStr2 } }), env, ctx);
  assert('已登录可访问预览接口', prev.status === 302 || prev.status === 200, `状态 ${prev.status}`);
  const denied = await worker.fetch(new Request(origin + `/preview/${fileId}`), env, ctx);
  assert('未登录访问预览被拒绝', denied.status === 401, `状态 ${denied.status}`);
}

// 5.8 预览必须优先走 Worker 代理，不能先跳直链
// （若跳 PUBLIC_BASE_URL，一旦那个域名没公开访问，缩略图就全 404，
//   表现就是「文件有时候加载不出来」）
{
  const cookieStr3 = Object.values(jar).filter(Boolean).join('; ');
  const res = await worker.fetch(new Request(origin + `/preview/${fileId}`, { headers: { cookie: cookieStr3 } }), env, ctx);
  assert('预览直接从 Worker 返回内容', res.status === 200, `状态 ${res.status}，location=${res.headers.get('location')}`);
}

// 5.7 配置接口要说明每个值来自哪里，方便判断「变量不见了会不会有影响」
{
  const cfgRes = await (await call('/api/config')).json();
  assert('配置接口返回来源信息', !!cfgRes.sources && !!cfgRes.sources.PUBLIC_BASE_URL, JSON.stringify(cfgRes.sources));
  assert('环境变量里的直链域名标记为环境变量', cfgRes.sources.PUBLIC_BASE_URL === '环境变量', cfgRes.sources.PUBLIC_BASE_URL);
  const noEnv = { ...env, PUBLIC_BASE_URL: '' };
  const src2 = await (await worker.fetch(new Request(origin + '/api/config', { headers: { cookie: Object.values(jar).filter(Boolean).join('; ') } }), noEnv, ctx)).json();
  assert('没有环境变量时标记为内置默认', src2.sources.PUBLIC_BASE_URL === '内置默认', src2.sources.PUBLIC_BASE_URL);
}

// 5.9 favicon：必须是云朵图标，不带文字
{
  const f1 = await worker.fetch(new Request(origin + '/favicon.svg'), env, ctx);
  assert('/favicon.svg 返回 SVG', f1.status === 200 && (f1.headers.get('content-type') || '').includes('svg'), f1.headers.get('content-type'));
  const svg = await f1.text();
  assert('图标是 SVG 图形', svg.startsWith('<svg') && svg.includes('circle'), svg.slice(0, 60));
  assert('图标不含文字', !/<text\b/.test(svg), 'favicon 里不该有 text 元素');
  const f2 = await worker.fetch(new Request(origin + '/favicon.ico'), env, ctx);
  assert('/favicon.ico 也能取到图标', f2.status === 200);
  const home = await (await worker.fetch(new Request(origin + '/'), env, ctx)).text();
  assert('页面声明了 svg 图标', home.includes('rel="icon"') && home.includes('/favicon.svg'));
}

// 5.10 直链自检：区分「没配」和「配了但存储层没读到」
{
  const cookieStr = Object.values(jar).filter(Boolean).join('; ');
  const diag = await (await worker.fetch(new Request(origin + '/api/diag/link', { headers: { cookie: cookieStr } }), env, ctx)).json();
  assert('自检接口返回 ok', diag.ok === true && diag.reason === 'ok', JSON.stringify(diag));
  assert('自检给出生效中的域名', diag.effectiveBase === 'https://cdn.example.com', JSON.stringify(diag));

  // 只在数据库里配、环境变量没有时，存储层也必须读到
  // （storage 必须读合并后的配置，否则读不到数据库里的值，
  //   于是设置页显示有、点直链却提示没配——就是这个问题）
  await env.DB.prepare("INSERT INTO settings (k, v) VALUES ('PUBLIC_BASE_URL', ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v").bind('https://cdn.example.com').run();
  const envDbOnly = { ...env, PUBLIC_BASE_URL: '' };
  const diag2 = await (await worker.fetch(new Request(origin + '/api/diag/link', { headers: { cookie: cookieStr } }), envDbOnly, ctx)).json();
  assert('配置只在数据库里时依然生效', diag2.effectiveBase === 'https://cdn.example.com', JSON.stringify(diag2));
}

// 5.11 直链不可用时要说明原因，而不是笼统说没配
{
  const envNone = { ...env, PUBLIC_BASE_URL: '' };
  // 清掉数据库里的公网域名
  await env.DB.prepare("DELETE FROM settings WHERE k = 'PUBLIC_BASE_URL'").run();
  const cookieStr = Object.values(jar).filter(Boolean).join('; ');
  const diag3 = await (await worker.fetch(new Request(origin + '/api/diag/link', { headers: { cookie: cookieStr } }), envNone, ctx)).json();
  assert('没配域名时自检给出 no_public_base', diag3.reason === 'no_public_base', JSON.stringify(diag3));
  // 还原，别影响后面的用例
  await env.DB.prepare("INSERT INTO settings (k, v) VALUES ('PUBLIC_BASE_URL', ?)").bind('https://cdn.example.com').run();
}

// 5.12 已用容量：存了文件后必须反映真实大小，不能一直显示 0
{
  const cookieStr = Object.values(jar).filter(Boolean).join('; ');
  const st = await (await worker.fetch(new Request(origin + '/api/stats', { headers: { cookie: cookieStr } }), env, ctx)).json();
  assert('stats 返回已用字节', typeof st.bytes === 'number', JSON.stringify(st));
  assert('已用字节不是 0（存了文件就该有量）', st.bytes > 0, `bytes=${st.bytes}`);
  assert('stats 返回容量上限', typeof st.quota === 'number', JSON.stringify(st));
  // 再放一个 20MB 的文件，用量必须跟着涨（不能一直停在初始值）
  const d2 = await (await call('/api/upload/presign', { method: 'POST', body: { name: 'big.bin', size: 20 * 1024 * 1024, mime: 'application/octet-stream' } })).json();
  await env.DB.prepare('UPDATE files SET size = ? WHERE id = ?').bind(20 * 1024 * 1024, d2.fileId).run();
  const st2 = await (await worker.fetch(new Request(origin + '/api/stats', { headers: { cookie: cookieStr } }), env, ctx)).json();
  assert('大文件后用量累加', st2.bytes === st.bytes + 20 * 1024 * 1024, `${st.bytes} → ${st2.bytes}`);
  // 清理，别影响后面的用例
  await env.DB.prepare('DELETE FROM files WHERE id = ?').bind(d2.fileId).run();
}

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
{
  const boot = /window\.__FILECOVE__=(\{[\s\S]*?\});<\/script>/.exec(body);
  const b = boot ? JSON.parse(boot[1]) : null;
  assert('分享页渲染正常', !!b && b.view === 'share', body.slice(0, 120));
  assert('分享页带上了文件信息', !!b && b.share && b.share.file_name === '你好 world.txt', JSON.stringify(b?.share));
  assert('需要密码时标注 need_password', !!b && b.need_password === true, JSON.stringify(b));
}

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
// 配置现在以数据库为准（网页里改），所以这里直接写 settings 表
await env.DB.prepare("INSERT INTO settings (k, v, updated_at) VALUES ('IP_MAX_DOWNLOADS', '1', 0)").run();
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

// 上面的流程是顺序执行的脚本，这里统一收口成一条断言，
// 失败时 vitest 会显示具体是哪一项（前面的 ❌ 行已经打印出来了）
test('端到端流程全部通过', () => {
  expect(failed, `有 ${failed} 项断言失败，见上面的 ❌ 输出`).toBe(0);
});
