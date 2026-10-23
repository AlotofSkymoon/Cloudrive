// 前端页面模板（零依赖单页，iOS 风格毛玻璃）
import { html } from './util.js';
const CSS = `
:root{--glass:rgba(255,255,255,.10);--stroke:rgba(255,255,255,.18);--txt:#f5f7fb;--sub:rgba(235,240,255,.62);--acc:#5b8cff}
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
html,body{margin:0;padding:0;min-height:100%}
body{font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","PingFang SC","Helvetica Neue",Arial,sans-serif;color:var(--txt);
background:#0a0f1a;background-image:radial-gradient(900px 600px at 8% -8%,#2b5cff55,transparent 60%),radial-gradient(800px 700px at 100% 0%,#a855f755,transparent 55%),radial-gradient(700px 700px at 50% 120%,#22d3ee44,transparent 60%);
background-attachment:fixed;padding:16px}
.blob{position:fixed;border-radius:50%;filter:blur(80px);opacity:.42;z-index:-1;pointer-events:none;animation:float 20s ease-in-out infinite}
.blob.b2{animation-duration:26s;animation-delay:-6s}
.blob.b3{animation-duration:32s;animation-delay:-13s}
@keyframes float{0%{transform:translate(0,0) scale(1)}50%{transform:translate(40px,-50px) scale(1.12)}100%{transform:translate(0,0) scale(1)}}
@media(prefers-reduced-motion:reduce){.blob{animation:none}}
.glass{background:linear-gradient(160deg,rgba(255,255,255,.15),rgba(255,255,255,.055));
backdrop-filter:blur(30px) saturate(185%);-webkit-backdrop-filter:blur(30px) saturate(185%);
border:1px solid rgba(255,255,255,.22);border-radius:26px;
box-shadow:0 12px 44px rgba(4,8,20,.42),inset 0 1px 0 rgba(255,255,255,.26)}
.wrap{max-width:980px;margin:0 auto;display:flex;flex-direction:column;gap:14px}
.top{display:flex;align-items:center;gap:12px;padding:14px 18px}
.logo{width:38px;height:38px;border-radius:12px;background:linear-gradient(145deg,#5b8cff,#a855f7);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:18px}
.brand{font-size:17px;font-weight:700;letter-spacing:.2px}
.muted{color:var(--sub);font-size:12.5px}
.spacer{flex:1}
.tabs{display:flex;gap:6px;padding:8px;overflow-x:auto}
.tab{flex:1;min-width:88px;text-align:center;padding:10px 12px;border-radius:16px;font-size:13.5px;color:var(--sub);cursor:pointer;border:1px solid transparent;white-space:nowrap}
.tab.on{background:linear-gradient(145deg,rgba(91,140,255,.42),rgba(168,85,247,.32));color:#fff;border-color:rgba(255,255,255,.28);font-weight:600;box-shadow:0 4px 16px rgba(91,140,255,.28),inset 0 1px 0 rgba(255,255,255,.3)}
.pane{padding:16px;display:none}.pane.on{display:block}
button,.btn{font-family:inherit;font-size:13.5px;color:#fff;background:rgba(255,255,255,.14);border:1px solid var(--stroke);
padding:10px 16px;border-radius:14px;cursor:pointer;transition:.18s;backdrop-filter:blur(8px)}
button:hover,.btn:hover{background:rgba(255,255,255,.22)}
button.primary{background:linear-gradient(145deg,#5b8cff,#7c5cff);border-color:transparent;font-weight:600;box-shadow:0 6px 20px rgba(91,140,255,.32),inset 0 1px 0 rgba(255,255,255,.35)}
button:active{transform:scale(.97)}
button.danger{background:rgba(255,86,86,.28);border-color:rgba(255,120,120,.35)}
button:disabled{opacity:.5;cursor:default}
input,select,textarea{font-family:inherit;font-size:14px;color:#fff;background:rgba(255,255,255,.10);border:1px solid var(--stroke);
border-radius:14px;padding:11px 13px;outline:none;width:100%}
input::placeholder{color:rgba(235,240,255,.45)}
label{display:block;font-size:12.5px;color:var(--sub);margin:0 0 6px 4px}
.row{display:flex;gap:10px;flex-wrap:wrap}.row>*{flex:1;min-width:130px}
table{width:100%;border-collapse:collapse;font-size:13px}
th,td{padding:10px 8px;text-align:left;border-bottom:1px solid rgba(255,255,255,.08);vertical-align:middle}
th{color:var(--sub);font-weight:500;font-size:12px}
td.name{max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.chk{width:16px;height:16px;accent-color:#5b8cff}
.bar{height:6px;border-radius:99px;background:rgba(255,255,255,.14);overflow:hidden;margin-top:8px}
.bar>i{display:block;height:100%;width:0;background:linear-gradient(90deg,#5b8cff,#a855f7);transition:width .2s}
.drop{border:1.5px dashed rgba(255,255,255,.28);border-radius:20px;padding:22px;text-align:center;color:var(--sub);font-size:13.5px}
.drop.on{background:rgba(91,140,255,.16);border-color:#5b8cff}
.tag{display:inline-block;padding:3px 9px;border-radius:99px;font-size:11.5px;background:rgba(255,255,255,.14);border:1px solid var(--stroke);color:var(--sub)}
.card{padding:14px;border-radius:18px;background:rgba(255,255,255,.07);border:1px solid var(--stroke);margin-bottom:10px}
.kv{display:flex;justify-content:space-between;gap:10px;font-size:13px;padding:5px 0;color:var(--sub)}
.kv b{color:#fff;font-weight:600}
.mask{position:fixed;inset:0;background:rgba(6,10,20,.55);backdrop-filter:blur(8px);display:none;align-items:center;justify-content:center;padding:16px;z-index:50}
.mask.on{display:flex}
.modal{width:100%;max-width:420px;padding:20px}
.toast{position:fixed;left:50%;bottom:28px;transform:translateX(-50%);padding:11px 18px;border-radius:99px;font-size:13px;opacity:0;transition:.25s;pointer-events:none;z-index:99}
.toast.on{opacity:1}
.empty{text-align:center;padding:26px;color:var(--sub);font-size:13px}
.alert{margin-top:12px;padding:11px 13px;border-radius:14px;font-size:12.5px;line-height:1.6}
.alert.bad{background:rgba(255,86,86,.18);border:1px solid rgba(255,120,120,.38);color:#ffd7d7}
.alert.warn{background:rgba(255,193,7,.16);border:1px solid rgba(255,213,79,.36);color:#ffe8a8}
.alert b{color:#fff}
.alert code{background:rgba(255,255,255,.14);padding:1px 5px;border-radius:6px;font-size:12px}
.center{min-height:70vh;display:flex;align-items:center;justify-content:center}
.login{width:100%;max-width:360px;padding:26px}
.big{display:flex;align-items:center;gap:14px;margin-bottom:14px}
.icon{width:52px;height:52px;border-radius:16px;background:linear-gradient(145deg,#5b8cff,#22d3ee);display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:800}
@media(max-width:640px){.wrap{padding-bottom:24px}th:nth-child(3),td:nth-child(3){display:none}}
`;

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function page(title, body, script = '') {
  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#0a0f1a">
<title>${esc(title)}</title>
<style>${CSS}</style></head>
<body>
<div class="blob" style="width:420px;height:420px;left:-120px;top:-80px;background:#3b6dff"></div>
<div class="blob b2" style="width:380px;height:380px;right:-100px;top:60px;background:#a855f7"></div>
<div class="blob b3" style="width:460px;height:460px;left:30%;bottom:-180px;background:#22d3ee"></div>
<div class="wrap">${body}</div>
<div class="mask" id="mask"><div class="glass modal" id="modal"></div></div>
<div class="toast glass" id="toast"></div>
<script>${script}</script></body></html>`;
}

export function renderErrorPage(title, msg) {
  return html(page(title, `<div class="glass center" style="flex-direction:column;gap:10px;padding:26px;text-align:center">
  <div class="icon">!</div><div style="font-size:18px;font-weight:700">${esc(title)}</div>
  <div class="muted">${esc(msg)}</div>
  <a href="/" class="btn" style="text-decoration:none;text-align:center;margin-top:6px">返回首页</a></div>`));
}

export function loginHtml() {
  return page('登录 · Filecove', `<div class="center"><div class="glass login">
  <div class="big"><div class="icon">FC</div><div><div style="font-size:18px;font-weight:700">Filecove</div><div class="muted">R2 / S3 网盘分享系统</div></div></div>
  <div id="hint"></div>
  <form id="f" onsubmit="return login()">
    <label>管理员密码</label>
    <input type="password" id="pwd" placeholder="请输入管理密码" autocomplete="current-password">
    <button class="primary" id="btn" type="submit" style="width:100%;margin-top:14px">登 录</button>
  </form>
  <div id="err"></div></div></div>`,
    `
var $hint=document.getElementById('hint'),$err=document.getElementById('err');
function show(el,cls,html){el.innerHTML='<div class="alert '+cls+'">'+html+'</div>';}
async function probe(){
  try{
    var r=await fetch('/api/status',{cache:'no-store'});
    var d=await r.json();
    if(!d.hasAdmin){
      show($hint,'bad','<b>Worker 侧还没设置管理员密码</b><br>到 Cloudflare → Workers → <code>filecove</code> → 设置 → 变量和机密，添加 <code>ADMIN_PASSWORD</code>（类型选「机密」）后重新部署；改用 GitHub Actions 部署则会自动注入。');
      document.getElementById('pwd').disabled=true;
      document.getElementById('btn').disabled=true;
      return;
    }
    if(!d.https){
      show($hint,'warn','<b>当前是 HTTP 访问</b><br>浏览器不会保存登录状态，请改用 HTTPS 打开本页。');
    }
    if(d.hasEnvAdmin&&d.hasDbAdmin){
      show($err,'warn','Worker 变量 <code>ADMIN_PASSWORD</code> 已设置，它的优先级高于后台「设置」里改过的密码，请用环境变量那个密码登录。');
    }
    // 已有有效会话却停在登录页 —— 直接进后台，省得再输一次密码
    if(d.admin){
      location.replace('/?_='+Date.now());
      return;
    }
    // 浏览器带了 Cookie 但 Worker 判定无效：说明不是密码问题，是会话没保住
    if(d.cookieState==='invalid'){
      show($hint,'bad','<b>登录状态未生效</b><br>浏览器发来了 Cookie，但 Worker 判定它无效——通常是密码改过导致旧会话失效，或同域存在多个部署互踢。请清空本站 Cookie 后重新登录。');
    }
    // 登录明明成功过，回来却完全没有 Cookie —— 浏览器没把它存下来
    var tried=false;try{tried=sessionStorage.getItem('fc_tried')==='1';}catch(e){}
    if(tried&&d.cookieState==='none'){
      show($hint,'bad','<b>浏览器没有保存登录状态</b><br>登录已成功，但 Cookie 没能写入。请检查：浏览器是否屏蔽了本站 Cookie / 处于无痕模式；是否装了隐私类扩展；或站点被 HTTP 与 HTTPS 混用。');
      try{sessionStorage.removeItem('fc_tried');}catch(e){}
    }
  }catch(e){/* 探不到就正常显示表单，不影响登录 */}
}
async function login(){
  var pwd=document.getElementById('pwd').value;
  $err.innerHTML='';
  var r=await fetch('/api/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({password:pwd})});
  var d=await r.json().catch(function(){return {}});
  if(d.ok){
    try{sessionStorage.setItem('fc_tried','1');}catch(e){}
    // replace + 时间戳：避免命中缓存的登录页，出现「登录成功却回到登录页」
    location.replace('/?_='+Date.now());
    return false;
  }
  show($err,'bad',d.reason==='no_password'?('<b>'+(d.msg||'未设置管理员密码')+'</b>'):(d.msg||('登录失败（HTTP '+r.status+'）')));
  return false;
}
probe();
document.getElementById('pwd').focus();
`);
}

export function shareHtml(o) {
  const s = o.share;
  const name = s.file_name;
  const size = Number(s.file_size) || 0;
  const sizeText =
    size < 1024 ? size + ' B' : size < 1048576 ? (size / 1024).toFixed(1) + ' KB' : size < 1073741824 ? (size / 1048576).toFixed(1) + ' MB' : (size / 1073741824).toFixed(2) + ' GB';
  const expireText = s.expires_at ? new Date(s.expires_at * 1000).toLocaleString('zh-CN') : '永久有效';
  const limitText = s.max_downloads ? s.max_downloads + ' 次（已下载 ' + s.downloads + ' 次）' : '不限次数（已下载 ' + s.downloads + ' 次）';
  const ext = (name.split('.').pop() || '').toLowerCase();
  const icon = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'heic'].includes(ext)
    ? '🖼️'
    : ['mp4', 'mov', 'webm', 'mkv'].includes(ext)
    ? '🎬'
    : ['mp3', 'wav', 'flac', 'm4a'].includes(ext)
    ? '🎵'
    : ['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)
    ? '🗜️'
    : ['pdf'].includes(ext)
    ? '📕'
    : '📄';

  let gate = '';
  if (o.needPassword) {
    gate += '<div style="margin-top:12px"><label>访问密码</label><input type="password" id="pwd" placeholder="请输入分享者设置的密码"></div>';
  }
  if (o.needTurnstile) {
    gate += '<div style="margin-top:12px"><label>人机验证</label><div id="cf-ts"></div></div>';
  }

  const disabled = o.error || o.banned;
  const btn = disabled
    ? '<button disabled style="width:100%;margin-top:16px">' + (o.banned ? 'IP 已被限制' : esc(o.error)) + '</button>'
    : '<button class="primary" style="width:100%;margin-top:16px" onclick="start()">立即下载</button>';

  const script = `
var CODE='${o.code}';
var NEED_PWD=${o.needPassword ? 'true' : 'false'};
var NEED_TS=${o.needTurnstile ? 'true' : 'false'};
var tsToken='';
function toast(m){var t=document.getElementById('toast');t.textContent=m;t.classList.add('on');setTimeout(function(){t.classList.remove('on')},2200);}
function onTsLoad(){if(NEED_TS&&window.turnstile){turnstile.render('#cf-ts',{sitekey:'${o.turnstileSitekey}',callback:function(t){tsToken=t;},'error-codes':function(){}});}}
async function start(){
  var btn=document.querySelector('button.primary');if(btn){btn.disabled=true;btn.textContent='校验中…';}
  var body={};
  if(NEED_PWD){body.password=document.getElementById('pwd').value||'';}
  if(NEED_TS){body.turnstile=tsToken;}
  if(NEED_PWD||NEED_TS){
    var r=await fetch('/s/'+CODE+'/unlock',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
    var d=await r.json();
    if(!d.ok){toast(d.msg||'校验失败');if(btn){btn.disabled=false;btn.textContent='立即下载';}return;}
  }
  location.href='/d/'+CODE;
}
async function copyDirect(){
  var r=await fetch('/direct/'+CODE,{headers:{'accept':'application/json'}});
  var d=await r.json();
  if(!d.ok){toast('获取直链失败');return;}
  try{await navigator.clipboard.writeText(d.url);toast('直链已复制');}catch(e){prompt('复制这条直链',d.url);}
}
`;
  const tsScript = o.needTurnstile
    ? '<script src="https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTsLoad&render=explicit" async defer></script>'
    : '';

  const body = `<div class="glass" style="padding:22px">
  <div class="big"><div class="icon">${icon}</div><div><div style="font-size:17px;font-weight:700;word-break:break-all">${esc(name)}</div>
  <div class="muted">${sizeText} · ${esc(o.share.file_mime || '文件')}</div></div></div>
  <div class="card">
    <div class="kv"><span>分享时间</span><b>${new Date(s.created_at * 1000).toLocaleString('zh-CN')}</b></div>
    <div class="kv"><span>有效期</span><b>${esc(expireText)}</b></div>
    <div class="kv"><span>下载限制</span><b>${esc(limitText)}</b></div>
  </div>
  ${gate}
  ${btn}
  <div class="row" style="margin-top:10px">
    <button onclick="copyDirect()">复制直链</button>
    <button onclick="location.href='/raw/${o.code}'">在线预览</button>
  </div>
  <div class="muted" style="margin-top:14px;text-align:center">由 Filecove 提供 · 文件存储在对象存储，下载走直链</div>
</div>${tsScript}`;

  return page('分享 · ' + name, body, script);
}

export function adminHtml(o) {
  const script = `
var FILES=[],SHARES=[],CFG={},SEL={};
function $(id){return document.getElementById(id);}
function toast(m){var t=$('toast');t.textContent=m;t.classList.add('on');setTimeout(function(){t.classList.remove('on')},2200);}
function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function fmt(n){n=Number(n)||0;if(n<1024)return n+' B';var u=['KB','MB','GB','TB'],v=n/1024,i=0;while(v>=1024&&i<u.length-1){v/=1024;i++;}return v.toFixed(v>=100?0:1)+' '+u[i];}
function t2s(ts){if(!ts)return '—';var d=new Date(ts*1000),p=function(x){return String(x).padStart(2,'0')};return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())+' '+p(d.getHours())+':'+p(d.getMinutes());}
async function api(p,opt){
  opt=opt||{};opt.credentials='same-origin';
  if(opt.body&&typeof opt.body!=='string'){opt.headers=Object.assign({'content-type':'application/json'},opt.headers||{});opt.body=JSON.stringify(opt.body);}
  var r=await fetch(p,opt);
  if(r.status===401){location.reload();return null;}
  var d=await r.json().catch(function(){return {}});
  if(!r.ok){toast(d.msg||('请求失败 '+r.status));return null;}
  return d;
}
function tab(name){
  var names=['files','shares','logs','bans','settings'];
  for(var i=0;i<names.length;i++){
    var t=$('tab-'+names[i]);if(t)t.classList.toggle('on',names[i]===name);
    var p=$('pane-'+names[i]);if(p)p.classList.toggle('on',names[i]===name);
  }
  if(name==='files')loadFiles(true);
  if(name==='shares')loadShares();
  if(name==='logs')loadLogs();
  if(name==='bans')loadBans();
  if(name==='settings')loadCfg();
}
function closeModal(){$('mask').classList.remove('on');$('modal').innerHTML='';}
$('mask').addEventListener('click',function(e){if(e.target===$('mask'))closeModal();});

/* ---------- 文件 ---------- */
var Q='',OFFSET=0,PAGE=100;
async function loadFiles(reset){
  if(reset)OFFSET=0;
  var u='/api/files?limit='+PAGE;
  if(Q)u+='&q='+encodeURIComponent(Q);
  if(OFFSET)u+='&offset='+OFFSET;
  var d=await api(u);if(!d)return;
  FILES=(OFFSET?FILES:[]).concat(d.files||[]);SEL={};
  OFFSET=d.next||0;
  renderFiles();
}
function onSearch(){clearTimeout(window.__st);window.__st=setTimeout(function(){Q=($('search').value||'').trim();OFFSET=0;loadFiles(true);},280);}
async function loadMore(){
  if(!OFFSET)return;
  var d=await api('/api/files?limit='+PAGE+(Q?'&q='+encodeURIComponent(Q):'')+'&offset='+OFFSET);
  if(!d)return;
  FILES=FILES.concat(d.files||[]);OFFSET=d.next||0;renderFiles();
}
async function syncBucket(){
  if(!confirm('扫描存储桶，把里面已有但没登记的文件加入列表？'))return;
  var d=await api('/api/sync',{method:'POST',body:{}});if(!d)return;
  toast('扫描 '+d.scanned+' 个对象，新增 '+d.added+' 条');
  OFFSET=0;loadFiles(true);loadStats();
}
function renderFiles(){
  var h='';
  if(!FILES.length){h='<div class="empty">还没有文件，点上面上传吧</div>';}
  else{
    h='<table><tr><th style="width:34px"></th><th>文件名</th><th style="width:82px">大小</th><th style="width:120px">上传时间</th><th style="width:150px">操作</th></tr>';
    for(var i=0;i<FILES.length;i++){var f=FILES[i];
      h+='<tr><td><input type="checkbox" class="chk" data-i="'+i+'"></td>'+
      '<td class="name" title="'+esc(f.name)+'">'+esc(f.name)+'</td>'+
      '<td>'+fmt(f.size)+'</td><td class="muted">'+t2s(f.uploaded_at)+'</td>'+
      '<td><button onclick="openShare('+i+')" style="padding:6px 10px">分享</button> '+
      '<button onclick="copyLink('+i+')" style="padding:6px 10px">直链</button> '+
      '<button class="danger" onclick="delFile('+"'"+f.id+"'"+')" style="padding:6px 10px">删</button></td></tr>';
    }
    h+='</table>';
  }
  $('fileList').innerHTML=h;
  $('moreBox').innerHTML=OFFSET?('<button style="width:100%;margin-top:12px" onclick="loadMore()">加载更多</button>'):'';
  var ck=document.querySelectorAll('.chk');
  for(var j=0;j<ck.length;j++){ck[j].onchange=function(){SEL[this.dataset.i]=this.checked;updateSelBar();};}
  updateSelBar();
}
function updateSelBar(){
  var ids=[];for(var k in SEL){if(SEL[k])ids.push(FILES[k].id);}
  $('selBar').innerHTML=ids.length?('已选 '+ids.length+' 个 <button class="danger" onclick="delSelected()">删除所选</button>'):'';
}
function selectedIds(){var ids=[];for(var k in SEL){if(SEL[k])ids.push(FILES[k].id);}return ids;}
async function delFile(id){if(!confirm('删除该文件？存储对象也会一并删除'))return;var d=await api('/api/files/delete',{method:'POST',body:{ids:[id]}});if(d){toast('已删除');loadFiles();}}
async function delSelected(){var ids=selectedIds();if(!ids.length)return;if(!confirm('删除所选 '+ids.length+' 个文件？'))return;var d=await api('/api/files/delete',{method:'POST',body:{ids:ids}});if(d){toast('已删除');loadFiles();}}
async function copyLink(i){
  var f=FILES[i];
  var d=await api('/api/files/'+f.id+'/link');
  if(!d)return;
  if(!d.url){toast('未配置 PUBLIC_BASE_URL，无法生成对象直链');return;}
  copyText(d.url);
}
function copyText(t){if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(t).then(function(){toast('已复制')},function(){prompt('复制',t)});}else{prompt('复制',t);}}

/* ---------- 上传 ---------- */
function pick(){ $('picker').click(); }
function onPick(e){ for(var i=0;i<e.target.files.length;i++){ queue.push(e.target.files[i]); } e.target.value=''; runQueue(); }
var queue=[],busy=false;
async function runQueue(){
  if(busy)return;busy=true;
  while(queue.length){
    var f=queue.shift();
    try{ await uploadOne(f); }catch(err){ toast('上传失败：'+err.message); }
  }
  busy=false;loadFiles();
}
function progress(p,txt){$('upbox').style.display='block';$('upbar').style.width=p+'%';$('uptxt').textContent=txt||('上传中 '+p+'%');}
function xhr(method,url,headers,blob,onProg){
  return new Promise(function(res,rej){
    var x=new XMLHttpRequest();x.open(method,url,true);
    for(var k in headers){x.setRequestHeader(k,headers[k]);}
    x.upload.onprogress=function(e){if(e.lengthComputable&&onProg)onProg(e.loaded/e.total);};
    x.onload=function(){ if(x.status>=200&&x.status<300){res(x);}else{rej(new Error('HTTP '+x.status));} };
    x.onerror=function(){rej(new Error('网络错误'));};
    x.send(blob);
  });
}
async function uploadOne(file){
  progress(0,'准备上传 '+file.name);
  var r=await api('/api/upload/presign',{method:'POST',body:{name:file.name,size:file.size,mime:file.type||'application/octet-stream'}});
  if(!r)throw new Error('获取上传凭证失败');
  if(r.mode==='direct'){
    await xhr('PUT',r.url,{'content-type':file.type||'application/octet-stream'},file,function(p){progress(Math.round(p*100),file.name);});
  }else if(r.mode==='multipart'){
    var partSize=r.partSize,parts=Math.ceil(file.size/partSize),uploaded=[],next=0,CONC=3;
    async function partWorker(){
      while(true){
        var i=next++;if(i>=parts)return;
        var chunk=file.slice(i*partSize,(i+1)*partSize);
        var x=await xhr('PUT',r.urls[i],{},chunk,function(){});
        var etag=x.getResponseHeader('ETag');
        if(!etag)throw new Error('读取分片 ETag 失败，请检查存储桶 CORS 是否暴露 ETag');
        uploaded.push({PartNumber:i+1,ETag:etag.replace(/"/g,'')});
        progress(Math.min(98,Math.round(uploaded.length/parts*100)),file.name+' '+uploaded.length+'/'+parts);
      }
    }
    await Promise.all(Array.from({length:Math.min(CONC,parts)},partWorker));
    uploaded.sort(function(a,b){return a.PartNumber-b.PartNumber;});
    progress(99,'合并分片…');
    await api('/api/upload/multipart/complete',{method:'POST',body:{key:r.key,uploadId:r.uploadId,parts:uploaded,fileId:r.fileId}});
  }else{
    await xhr('PUT',r.url,{'content-type':file.type||'application/octet-stream'},file,function(p){progress(Math.round(p*100),file.name);});
    await api('/api/upload/confirm',{method:'POST',body:{fileId:r.fileId,size:file.size}});
  }
  progress(100,file.name+' 完成');
  setTimeout(function(){$('upbox').style.display='none';},1200);
}
/* 拖拽 */
function initDrop(){
  var z=$('drop');
  ['dragenter','dragover'].forEach(function(e){z.addEventListener(e,function(ev){ev.preventDefault();z.classList.add('on');});});
  ['dragleave','drop'].forEach(function(e){z.addEventListener(e,function(ev){ev.preventDefault();z.classList.remove('on');});});
  z.addEventListener('drop',function(ev){var fs=ev.dataTransfer.files;for(var i=0;i<fs.length;i++){queue.push(fs[i]);}runQueue();});
}

/* ---------- 分享 ---------- */
function openShare(i){
  var f=FILES[i];
  $('modal').innerHTML='<div style="font-size:16px;font-weight:700;margin-bottom:12px">创建分享</div>'+
   '<div class="muted" style="margin-bottom:12px;word-break:break-all">'+esc(f.name)+'</div>'+
   '<div><label>有效期</label><select id="m-exp"><option value="0">永久</option><option value="3600">1 小时</option><option value="86400">1 天</option><option value="604800">7 天</option><option value="2592000">30 天</option></select></div>'+
   '<div style="margin-top:10px"><label>访问密码（留空则不需要）</label><input id="m-pwd" placeholder="可留空"></div>'+
   '<div style="margin-top:10px"><label>下载次数（0 = 不限）</label><input id="m-max" type="number" value="0" min="0"></div>'+
   '<div class="row" style="margin-top:16px"><button onclick="closeModal()">取消</button><button class="primary" onclick="createShare('+"'"+f.id+"'"+')">创建</button></div>';
  $('mask').classList.add('on');
}
async function createShare(id){
  var body={file_id:id,password:$('m-pwd').value,expires_in:Number($('m-exp').value),max_downloads:Number($('m-max').value)||0};
  var d=await api('/api/shares',{method:'POST',body:body});
  if(!d)return;
  closeModal();
  $('modal').innerHTML='<div style="font-size:16px;font-weight:700;margin-bottom:10px">分享已创建</div>'+
   '<input id="m-link" value="'+esc(d.url)+'" readonly>'+
   '<div class="row" style="margin-top:12px"><button onclick="copyText($('+"'m-link'"+').value)">复制链接</button><button class="primary" onclick="closeModal();tab('+"'shares'"+')">查看分享</button></div>';
  $('mask').classList.add('on');
  loadShares();
}
async function loadShares(){
  var d=await api('/api/shares');if(!d)return;SHARES=d.shares||[];
  var h='';
  if(!SHARES.length){h='<div class="empty">还没有分享链接</div>';}
  else{
    h='<table><tr><th>文件</th><th style="width:70px">次数</th><th style="width:118px">有效期</th><th style="width:170px">操作</th></tr>';
    for(var i=0;i<SHARES.length;i++){var s=SHARES[i];
      h+='<tr><td class="name" title="'+esc(s.name)+'">'+esc(s.name)+(s.password_hash?' 🔒':'')+'</td>'+
      '<td>'+s.downloads+(s.max_downloads?'/'+s.max_downloads:'')+'</td>'+
      '<td class="muted">'+(s.expires_at?t2s(s.expires_at):'永久')+'</td>'+
      '<td><button onclick="copyText('+"'"+esc(s.url)+"'"+')" style="padding:6px 10px">链接</button> '+
      '<button onclick="copyDirectShare('+"'"+s.code+"'"+')" style="padding:6px 10px">直链</button> '+
      '<button class="danger" onclick="delShare('+"'"+s.code+"'"+')" style="padding:6px 10px">删</button></td></tr>';
    }
    h+='</table>';
  }
  $('shareList').innerHTML=h;
}
async function copyDirectShare(code){
  var d=await api('/direct/'+code);if(!d)return;copyText(d.url);
}
async function delShare(code){if(!confirm('删除这个分享链接？'))return;var d=await api('/api/shares/delete',{method:'POST',body:{code:code}});if(d){toast('已删除');loadShares();}}

/* ---------- 记录 / 封禁 ---------- */
async function loadLogs(){
  var d=await api('/api/logs');if(!d)return;
  var h='<table><tr><th>时间</th><th>文件</th><th>IP</th><th style="width:70px">地区</th><th style="width:80px">大小</th><th style="width:60px"></th></tr>';
  var arr=d.logs||[];
  if(!arr.length){h='<div class="empty">暂无下载记录</div>';}
  else{for(var i=0;i<arr.length;i++){var l=arr[i];
    h+='<tr><td class="muted">'+t2s(l.ts)+'</td><td class="name">'+esc(l.name||l.code)+'</td><td>'+esc(l.ip)+'</td><td>'+esc(l.country||'')+'</td><td>'+fmt(l.bytes)+'</td><td><button class="danger" style="padding:5px 9px" onclick="banIp('+"'"+l.ip+"'"+')">封</button></td></tr>';
  }h+='</table>';}
  $('logList').innerHTML=h;
}
async function banIp(ip){
  var m=prompt('封禁 '+ip+' 多少分钟？',CFG.banMinutes||60);
  if(!m)return;
  var d=await api('/api/bans',{method:'POST',body:{ip:ip,minutes:Number(m)||60,reason:'管理员手动封禁'}});
  if(d){toast('已封禁');if($('pane-bans').classList.contains('on'))loadBans();}
}
async function loadBans(){
  var d=await api('/api/bans');if(!d)return;
  var arr=d.bans||[],h='';
  if(!arr.length){h='<div class="empty">当前没有封禁记录</div>';}
  else{h='<table><tr><th>IP</th><th>原因</th><th style="width:120px">解封时间</th><th style="width:70px"></th></tr>';
  for(var i=0;i<arr.length;i++){var b=arr[i];h+='<tr><td>'+esc(b.ip)+'</td><td class="muted">'+esc(b.reason||'')+'</td><td class="muted">'+t2s(b.until)+'</td><td><button style="padding:5px 9px" onclick="unban('+"'"+b.ip+"'"+')">解封</button></td></tr>';}
  h+='</table>';}
  $('banList').innerHTML=h;
}
async function unban(ip){var d=await api('/api/bans/unban',{method:'POST',body:{ip:ip}});if(d){toast('已解封');loadBans();}}

/* ---------- 设置 ---------- */
async function loadCfg(){
  var d=await api('/api/config');if(!d)return;CFG=d.config||{};
  var c=CFG;
  $('cfg').innerHTML=
   '<div><label>对象公网域名 PUBLIC_BASE_URL（下载直链用，如 https://cdn.example.com）</label><input id="c-base" value="'+esc(c.publicBaseUrl||'')+'"></div>'+
   '<div style="margin-top:10px"><label>下载方式</label><select id="c-mode">'+
   ['auto','public','signed','proxy'].map(function(m){return '<option value="'+m+'"'+(c.downloadMode===m?' selected':'')+'>'+m+'</option>';}).join('')+'</select></div>'+
   '<div class="row" style="margin-top:10px"><div><label>单 IP 下载上限（次/小时）</label><input id="c-ipmax" type="number" value="'+esc(c.ipMaxDownloads)+'"></div>'+
   '<div><label>超限封禁（分钟）</label><input id="c-ban" type="number" value="'+esc(c.banMinutes)+'"></div></div>'+
   '<div style="margin-top:10px"><label>月度流量上限（GB，0=不限）</label><input id="c-traffic" type="number" value="'+esc((c.monthlyTrafficLimit/1073741824).toFixed(2))+'"></div>'+
   '<div class="row" style="margin-top:10px"><div><label>Turnstile Sitekey</label><input id="c-tkey" value="'+esc(c.turnstileSitekey||'')+'"></div>'+
   '<div><label>Turnstile Secret</label><input id="c-tsec" value="'+esc(c.turnstileSecret||'')+'"></div></div>'+
   '<div style="margin-top:10px"><label>开启人机验证</label><select id="c-ton"><option value="1"'+(c.turnstileEnabled?' selected':'')+'>开启</option><option value="0"'+(!c.turnstileEnabled?' selected':'')+'>关闭</option></select></div>'+
   '<div style="margin-top:10px"><label>修改管理员密码（留空不改）</label><input id="c-pwd" type="password" placeholder="留空表示不修改"></div>'+
   '<button class="primary" style="margin-top:16px;width:100%" onclick="saveCfg()">保存设置</button>';
}
async function saveCfg(){
  var body={publicBaseUrl:$('c-base').value,downloadMode:$('c-mode').value,
    ipMaxDownloads:Number($('c-ipmax').value),banMinutes:Number($('c-ban').value),
    monthlyTrafficLimit:Math.round(Number($('c-traffic').value)*1073741824),
    turnstileSitekey:$('c-tkey').value,turnstileSecret:$('c-tsec').value,
    turnstileEnabled:$('c-ton').value==='1',adminPassword:$('c-pwd').value};
  var d=await api('/api/config',{method:'POST',body:body});
  if(d){toast('已保存');loadCfg();}
}
async function logout(){await fetch('/api/logout',{method:'POST'});location.href='/';}
async function loadStats(){
  var d=await api('/api/stats');if(!d)return;
  $('stats').innerHTML='<span class="tag">文件 '+d.files+'</span> <span class="tag">分享 '+d.shares+'</span> <span class="tag">下载 '+d.downloads+'</span> <span class="tag">本月流量 '+fmt(d.traffic)+(d.limit?' / '+fmt(d.limit):'')+'</span>';
}
initDrop();loadStats();tab('files');
`;

  const body = `<div class="glass top">
  <div class="logo">S3</div>
  <div><div class="brand">Filecove</div><div class="muted">R2 / S3 网盘 · ${esc(o.driver)} · ${esc(o.bucket)}</div></div>
  <div class="spacer"></div>
  <div class="muted" id="stats"></div>
  <button onclick="logout()">退出</button>
</div>
<div class="glass tabs">
  <div class="tab on" id="tab-files" onclick="tab('files')">文件</div>
  <div class="tab" id="tab-shares" onclick="tab('shares')">分享</div>
  <div class="tab" id="tab-logs" onclick="tab('logs')">记录</div>
  <div class="tab" id="tab-bans" onclick="tab('bans')">封禁</div>
  <div class="tab" id="tab-settings" onclick="tab('settings')">设置</div>
</div>

<div class="glass pane on" id="pane-files">
  <div class="drop" id="drop" onclick="pick()">点击选择文件，或把文件拖到这里（支持多选 / 大文件分片）</div>
  <input type="file" id="picker" multiple hidden onchange="onPick(event)">
  <div class="bar" id="upbox" style="display:none"><i id="upbar"></i></div>
  <div class="muted" id="uptxt" style="margin-bottom:8px"></div>
  <div class="row" style="margin-top:12px">
    <input id="search" placeholder="搜索文件名…" oninput="onSearch()" style="flex:3">
    <button onclick="syncBucket()" style="flex:0 0 auto;min-width:104px">同步桶内</button>
  </div>
  <div id="selBar" style="margin:10px 0"></div>
  <div id="fileList"><div class="empty">加载中…</div></div>
  <div id="moreBox"></div>
</div>

<div class="glass pane" id="pane-shares"><div id="shareList"><div class="empty">加载中…</div></div></div>
<div class="glass pane" id="pane-logs"><div id="logList"><div class="empty">加载中…</div></div></div>
<div class="glass pane" id="pane-bans"><div id="banList"><div class="empty">加载中…</div></div></div>
<div class="glass pane" id="pane-settings"><div id="cfg"></div></div>`;

  return page('Filecove 管理', body, script);
}
