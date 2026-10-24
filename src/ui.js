// 前端页面模板（零依赖单页，无构建步骤）
// 视觉：纸质米白 + 墨黑 + 衬线标题 + 等宽数字，细线分隔
import { html } from './util.js';

export const VERSION = '1.0.0';

const CSS = `
:root{
  --paper:#f4f2ec;
  --surface:#fbfaf7;
  --ink:#1c1b18;
  --ink-2:#3d3a33;
  --muted:#6f6a60;
  --faint:#9b958a;
  --rule:#ddd8cd;
  --rule-soft:#e8e3d8;
  --accent:#1f4d3f;
  --danger:#a3341f;
  --sel:#efede4;
  --mono:ui-monospace,"SF Mono","JetBrains Mono",Menlo,Consolas,"Liberation Mono",monospace;
  --sans:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Noto Sans SC","Hiragino Sans GB","Microsoft YaHei",sans-serif;
  --serif:Georgia,"Songti SC","Noto Serif SC",serif;
}
*{box-sizing:border-box}
html,body{margin:0;padding:0}
body{background:var(--paper);color:var(--ink);font-family:var(--sans);font-size:13.5px;line-height:1.5;
  -webkit-font-smoothing:antialiased}
button{font:inherit;color:inherit;background:none;border:0;padding:0;cursor:pointer}
input,select,textarea{font:inherit;color:inherit}
::selection{background:#d9e4dd}

.btn{display:inline-flex;align-items:center;gap:6px;height:29px;padding:0 11px;
  border:1px solid var(--rule);border-radius:2px;font-size:12.5px;color:var(--ink-2);
  background:var(--surface);white-space:nowrap}
.btn:hover{border-color:var(--faint);background:#fff}
.btn.solid{background:var(--ink);border-color:var(--ink);color:#fbfaf7}
.btn.solid:hover{background:#000;border-color:#000}
.btn.sm{height:25px;font-size:12px;padding:0 9px}
.btn.danger{color:var(--danger);border-color:#e3cfc9}
.btn.danger:hover{background:#fbf1ee;border-color:#d6b3ab}
button:disabled{opacity:.45;cursor:default}

/* ---------- 控制台骨架 ---------- */
.app{display:flex;min-height:calc(100vh - 34px);max-width:1240px;margin:0 auto}
.rail{width:208px;flex:0 0 208px;padding:22px 18px 18px 22px;border-right:1px solid var(--rule);
  display:flex;flex-direction:column;position:sticky;top:0;height:calc(100vh - 34px)}
.brand{display:flex;align-items:baseline;gap:7px;margin-bottom:2px}
.brand h1{font-family:var(--serif);font-size:21px;font-weight:600;letter-spacing:-.3px;margin:0}
.brand span{font-family:var(--mono);font-size:9.5px;color:var(--faint);letter-spacing:.08em}
.brand-sub{font-family:var(--mono);font-size:10px;color:var(--faint);letter-spacing:.04em;margin-bottom:26px}
.nav{display:flex;flex-direction:column;gap:1px;margin:0 -8px}
.nav button{display:flex;align-items:center;gap:9px;padding:7px 8px 7px 10px;font-size:13px;color:var(--muted);
  text-align:left;border-left:2px solid transparent}
.nav button:hover{color:var(--ink);background:rgba(28,27,24,.035)}
.nav button.on{color:var(--ink);border-left-color:var(--accent);background:rgba(28,27,24,.045);font-weight:600}
.nav .no{font-family:var(--mono);font-size:9.5px;color:var(--faint);letter-spacing:.06em;width:15px;flex:0 0 15px}
.nav button.on .no{color:var(--accent)}
.nav .n{margin-left:auto;font-family:var(--mono);font-size:10px;color:var(--faint)}
.rail-foot{margin-top:auto;padding-top:16px;border-top:1px solid var(--rule-soft)}
.meter-label{display:flex;justify-content:space-between;font-family:var(--mono);font-size:9.5px;color:var(--faint);
  letter-spacing:.05em;margin-bottom:6px}
.meter{height:3px;background:var(--rule);position:relative;overflow:hidden}
.meter i{position:absolute;inset:0 auto 0 0;width:0;background:var(--accent);transition:width .3s}
.who{display:flex;align-items:center;gap:7px;margin-top:16px;font-size:11.5px;color:var(--muted)}
.dot{width:5px;height:5px;background:var(--accent);flex:0 0 5px}
.who button{margin-left:auto;font-size:11.5px;color:var(--muted);text-decoration:underline;
  text-underline-offset:2px;text-decoration-color:var(--rule)}
.who button:hover{color:var(--danger)}

main{flex:1;min-width:0;padding:24px 30px 30px}
.head{display:flex;align-items:flex-end;gap:12px;padding-bottom:13px;border-bottom:1px solid var(--ink)}
.head h2{font-size:19px;font-weight:600;letter-spacing:-.2px;margin:0}
.head .count{font-family:var(--mono);font-size:10.5px;color:var(--faint);letter-spacing:.04em;padding-bottom:2px}
.head .sp{flex:1}
.head .acts{display:flex;gap:8px;align-items:center}

.toolbar{display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--rule-soft)}
.search{flex:1;display:flex;align-items:center;gap:7px;max-width:340px;border-bottom:1px solid var(--rule);padding-bottom:4px}
.search svg{flex:0 0 12px;color:var(--faint)}
.search input{border:0;outline:0;background:none;width:100%;font-size:12.5px}
.search input::placeholder{color:var(--faint)}
.toolbar .sp{flex:1}
.selinfo{font-family:var(--mono);font-size:10.5px;color:var(--muted);letter-spacing:.03em}
.linkbtn{font-size:12px;color:var(--muted);text-decoration:underline;text-underline-offset:2px;text-decoration-color:var(--rule)}
.linkbtn:hover{color:var(--ink)}

.drop{margin:12px 0 0;border:1px dashed var(--rule);border-radius:2px;padding:13px 14px;display:flex;
  align-items:center;gap:10px;cursor:pointer;color:var(--muted);font-size:12.5px;transition:background .12s,border-color .12s}
.drop:hover{border-color:var(--faint);background:rgba(28,27,24,.018)}
.drop.on{border-color:var(--accent);background:rgba(31,77,63,.05);color:var(--accent)}
.drop .plus{font-family:var(--mono);font-size:13px;color:var(--faint);width:12px}
.drop.on .plus{color:var(--accent)}
.drop .hint{margin-left:auto;font-family:var(--mono);font-size:10px;color:var(--faint);letter-spacing:.02em}

table{width:100%;border-collapse:collapse;margin-top:2px}
thead th{font-family:var(--mono);font-size:9.5px;font-weight:400;color:var(--faint);letter-spacing:.09em;
  text-align:left;padding:9px 8px 8px;border-bottom:1px solid var(--rule);white-space:nowrap}
thead th.r{text-align:right}
tbody td{padding:0 8px;height:46px;border-bottom:1px solid var(--rule-soft);vertical-align:middle}
tbody tr:hover{background:var(--sel)}
tbody tr.checked{background:var(--sel)}
td.r{text-align:right}
.num{font-family:var(--mono);font-size:11.5px;color:var(--ink-2);font-variant-numeric:tabular-nums}
.time{font-family:var(--mono);font-size:11px;color:var(--muted);font-variant-numeric:tabular-nums;white-space:nowrap}
.mono{font-family:var(--mono);font-size:11px;color:var(--muted);letter-spacing:.02em}

.chk{width:13px;height:13px;border:1px solid var(--faint);border-radius:1px;display:inline-block;
  position:relative;vertical-align:-2px;cursor:pointer}
tr.checked .chk{background:var(--accent);border-color:var(--accent)}
tr.checked .chk::after{content:"";position:absolute;left:3.5px;top:.5px;width:4px;height:7px;
  border:solid #fff;border-width:0 1.5px 1.5px 0;transform:rotate(42deg)}

.fname{display:flex;align-items:center;gap:9px;min-width:0}
.ext{font-family:var(--mono);font-size:8.5px;letter-spacing:.04em;color:var(--muted);border:1px solid var(--rule);
  padding:2px 0;width:30px;text-align:center;flex:0 0 30px;background:var(--surface)}
.fname b{font-weight:400;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.thumb{width:30px;height:30px;flex:0 0 30px;object-fit:cover;border-radius:2px;background:var(--rule-soft);cursor:zoom-in}
.rowmeta{display:none;font-family:var(--mono);font-size:9.5px;color:var(--faint);margin-left:auto;
  white-space:nowrap;padding-left:8px}

.ops{display:flex;align-items:center;justify-content:flex-end;font-size:11.5px;white-space:nowrap}
.ops button{color:var(--muted);padding:3px 0}
.ops button:hover{color:var(--ink);text-decoration:underline;text-underline-offset:2px}
.ops .sep{color:var(--rule);padding:0 7px;user-select:none}
.ops button.del:hover{color:var(--danger)}

.panel{display:none;padding-top:2px}
.panel.on{display:block}
.empty{padding:40px 8px;color:var(--faint);font-size:12.5px}
.empty code{font-family:var(--mono);font-size:11px;color:var(--muted)}
.alert{padding:10px 12px;border:1px solid var(--rule);background:var(--surface);font-size:12px;
  line-height:1.65;margin-bottom:12px}
.alert.bad{border-color:#e3cfc9;background:#fbf1ee;color:#8a2c19}
.alert.warn{border-color:#e0d7bd;background:#faf6e8;color:#7a6320}
.alert b{color:var(--ink)}
.alert code{font-family:var(--mono);font-size:11px}

/* 设置 */
.sec-title{font-family:var(--mono);font-size:9.5px;letter-spacing:.1em;color:var(--faint);margin:26px 0 4px}
.sec-title:first-child{margin-top:8px}
.form{max-width:640px}
.field{display:flex;align-items:center;gap:14px;padding:11px 0;border-bottom:1px solid var(--rule-soft)}
.field label{width:170px;flex:0 0 170px;font-size:12.5px;color:var(--ink-2)}
.field .desc{font-size:11px;color:var(--faint);margin-top:2px}
.field input,.field select{flex:1;border:1px solid var(--rule);border-radius:2px;background:var(--surface);
  padding:5px 8px;font-size:12.5px;outline:0;min-width:0}
.field input:focus,.field select:focus{border-color:var(--accent)}
.field .unit{font-family:var(--mono);font-size:10px;color:var(--faint);white-space:nowrap}
.src{font-family:var(--mono);font-size:9px;letter-spacing:.06em;color:var(--faint);
  border:1px solid var(--rule-soft);padding:1px 4px;margin-left:6px;white-space:nowrap}
.switch{width:28px;height:15px;border:1px solid var(--faint);border-radius:99px;position:relative;
  background:transparent;flex:0 0 28px}
.switch::after{content:"";position:absolute;top:2px;left:2px;width:9px;height:9px;background:var(--faint);
  border-radius:50%;transition:.14s}
.switch.on{border-color:var(--accent);background:rgba(31,77,63,.08)}
.switch.on::after{left:15px;background:var(--accent)}
.savebar{position:sticky;bottom:34px;z-index:15;margin:26px -30px 0;padding:11px 30px;background:#f7f5ef;
  border-top:1px solid var(--rule);display:flex;align-items:center;gap:12px;font-size:12px;color:var(--muted)}
.savebar .sp{flex:1}

/* 分享列表 */
.share-card{border:1px solid var(--rule);background:var(--surface);padding:13px 14px;margin-top:10px;
  display:flex;align-items:center;gap:14px;flex-wrap:wrap}
.share-card .code{font-family:var(--mono);font-size:13px;letter-spacing:.06em;color:var(--ink);
  border-bottom:1px solid var(--rule);padding-bottom:1px}
.share-card .meta{font-family:var(--mono);font-size:10px;color:var(--faint);letter-spacing:.03em}
.share-card .sp{flex:1}

/* 状态栏 */
.status{position:fixed;left:0;right:0;bottom:0;height:34px;background:var(--surface);border-top:1px solid var(--rule);
  display:flex;align-items:center;font-family:var(--mono);font-size:10px;color:var(--muted);letter-spacing:.03em;
  padding:0 14px;z-index:20}
.status .cell{padding:0 12px;border-right:1px solid var(--rule-soft);height:100%;display:flex;align-items:center;gap:6px}
.status .cell:first-child{padding-left:0}
.status .sp{flex:1}
.status .cell:last-child{border:0;padding-right:0}
.status .ok{width:5px;height:5px;background:var(--accent)}

/* 弹层 */
.mask{position:fixed;inset:0;background:rgba(28,27,24,.26);display:none;align-items:center;justify-content:center;
  padding:18px;z-index:60}
.mask.on{display:flex}
.modal{background:var(--surface);border:1px solid var(--ink);width:100%;max-width:392px}
.modal-h{padding:14px 16px 12px;border-bottom:1px solid var(--rule);display:flex;align-items:baseline;gap:8px}
.modal-h h3{font-size:14px;font-weight:600;margin:0}
.modal-h .x{margin-left:auto;color:var(--faint);font-size:15px;line-height:1}
.modal-h .x:hover{color:var(--ink)}
.modal-b{padding:14px 16px}
.modal-b .row{display:flex;align-items:center;gap:10px;margin-bottom:11px}
.modal-b .row label{width:64px;flex:0 0 64px;font-size:12px;color:var(--muted)}
.modal-b .row input,.modal-b .row select{flex:1;border:1px solid var(--rule);background:#fff;border-radius:2px;
  padding:5px 8px;font-size:12px;outline:0;min-width:0}
.modal-b .row input:focus,.modal-b .row select:focus{border-color:var(--accent)}
.modal-b .row .unit{font-family:var(--mono);font-size:10px;color:var(--faint);white-space:nowrap}
.linkbox{display:flex;border:1px solid var(--rule);background:#fff}
.linkbox input{border:0;flex:1;font-family:var(--mono);font-size:11px;padding:7px 8px;outline:0;min-width:0;background:none}
.linkbox button{border-left:1px solid var(--rule);padding:0 10px;font-size:11.5px;color:var(--ink-2)}
.linkbox button:hover{background:var(--sel)}
.modal-f{padding:11px 16px;border-top:1px solid var(--rule);display:flex;justify-content:flex-end;gap:8px;background:#f7f5ef}

/* 上传队列 */
.uploader{position:fixed;right:16px;bottom:46px;width:320px;background:var(--surface);border:1px solid var(--ink);
  z-index:50;display:none}
.uploader.on{display:block}
.u-head{display:flex;align-items:center;gap:8px;padding:9px 12px;border-bottom:1px solid var(--rule);font-size:12px}
.u-head .mono{font-size:10px}
.u-head .sp{flex:1}
.u-head button{color:var(--faint);font-size:11px}
.u-head button:hover{color:var(--ink)}
.u-item{display:flex;align-items:center;gap:9px;padding:9px 12px;border-bottom:1px solid var(--rule-soft)}
.u-item:last-child{border-bottom:0}
.u-body{flex:1;min-width:0}
.u-body b{display:block;font-weight:400;font-size:11.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.u-bar{display:block;height:2px;background:var(--rule);margin-top:5px;position:relative}
.u-bar i{position:absolute;inset:0 auto 0 0;background:var(--accent);transition:width .3s}
.u-pct{font-family:var(--mono);font-size:9.5px;color:var(--faint);width:36px;text-align:right}

.toast{position:fixed;left:14px;bottom:46px;background:var(--ink);color:#fbfaf7;font-family:var(--mono);
  font-size:10.5px;letter-spacing:.03em;padding:7px 11px;opacity:0;transform:translateY(4px);
  transition:.16s;pointer-events:none;z-index:70}
.toast.on{opacity:1;transform:none}

.lightbox{position:fixed;inset:0;background:rgba(28,27,24,.9);display:none;align-items:center;justify-content:center;
  z-index:120;padding:16px;cursor:zoom-out}
.lightbox.on{display:flex}
.lightbox img{max-width:100%;max-height:100%}

/* ---------- 独立页 ---------- */
.standalone{min-height:100vh;display:flex;flex-direction:column}
.sa-head{display:flex;align-items:center;gap:8px;padding:20px 24px;font-family:var(--mono);font-size:10px;
  color:var(--faint);letter-spacing:.05em}
.sa-head .wm{font-family:var(--serif);font-size:15px;color:var(--ink);letter-spacing:-.2px;font-weight:600}
.sa-head .sp{flex:1}
.sa-body{flex:1;display:flex;align-items:center;justify-content:center;padding:20px 20px 60px}

/* 登录 */
.login{width:100%;max-width:330px}
.login .kicker{font-family:var(--mono);font-size:9.5px;letter-spacing:.12em;color:var(--faint);margin-bottom:8px}
.login h2{font-family:var(--serif);font-size:26px;font-weight:600;letter-spacing:-.4px;margin:0 0 6px}
.login p.sub{font-size:12px;color:var(--muted);margin:0 0 26px;line-height:1.7}
.login label{display:block;font-family:var(--mono);font-size:9.5px;letter-spacing:.08em;color:var(--faint);margin-bottom:6px}
.login input{width:100%;border:0;border-bottom:1px solid var(--ink);background:none;padding:6px 0 8px;
  font-size:15px;outline:0;letter-spacing:.02em;color:var(--ink)}
.login input:focus{border-bottom-color:var(--accent)}
.login .hint{font-family:var(--mono);font-size:9.5px;color:var(--faint);margin-top:7px;letter-spacing:.02em}
.login .btn{width:100%;height:36px;justify-content:center;margin-top:22px;font-size:13px}
.login .foot{display:flex;justify-content:space-between;margin-top:18px;font-family:var(--mono);font-size:9.5px;color:var(--faint)}
.login .foot a{color:var(--muted);text-decoration:underline;text-underline-offset:2px;text-decoration-color:var(--rule)}
.login-grid{display:grid;grid-template-columns:300px 190px;gap:46px;align-items:start}
.login-side{border-left:1px solid var(--rule);padding-left:26px}
.login-side .cap{font-family:var(--mono);font-size:9px;letter-spacing:.12em;color:var(--faint);margin-bottom:10px}
.login-side .kv{display:flex;justify-content:space-between;gap:12px;padding:7px 0;border-bottom:1px solid var(--rule-soft);
  font-family:var(--mono);font-size:9.5px;letter-spacing:.03em}
.login-side .kv span{color:var(--faint)}
.login-side .kv b{font-weight:400;color:var(--ink-2);font-size:9.5px;overflow:hidden;text-overflow:ellipsis}

/* 分享页 */
.share-wrap{width:100%;max-width:520px;margin:0 auto;padding:0 20px 60px}
.share-card-lg{border:1px solid var(--rule);background:var(--surface)}
.sc-head{padding:16px 18px;border-bottom:1px solid var(--rule-soft);display:flex;align-items:center;gap:10px}
.sc-head .ext{width:34px;flex:0 0 34px;font-size:9px;padding:3px 0}
.sc-head .t{min-width:0}
.sc-head .t b{display:block;font-weight:500;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sc-head .t span{font-family:var(--mono);font-size:9.5px;color:var(--faint);letter-spacing:.03em}
.preview{border-bottom:1px solid var(--rule-soft);display:flex;align-items:center;justify-content:center;
  min-height:190px;background-image:repeating-linear-gradient(45deg,transparent,transparent 7px,rgba(28,27,24,.045) 7px,rgba(28,27,24,.045) 8px);
  color:var(--faint);font-family:var(--mono);font-size:9.5px;letter-spacing:.1em}
.preview img{display:block;width:100%;max-height:340px;object-fit:contain;cursor:zoom-in}
.sc-meta{padding:4px 18px 14px}
.sc-meta .row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--rule-soft);font-size:12px}
.sc-meta .row:last-child{border-bottom:0}
.sc-meta .row span{color:var(--muted)}
.sc-meta .row b{font-family:var(--mono);font-weight:400;font-size:11.5px}
.sc-act{padding:14px 18px;border-top:1px solid var(--rule);background:#f7f5ef}
.sc-act .field-inline{display:flex;gap:8px;margin-bottom:10px}
.sc-act input{flex:1;border:1px solid var(--rule);background:#fff;border-radius:2px;padding:7px 9px;font-size:12.5px;outline:0;min-width:0}
.sc-act input:focus{border-color:var(--accent)}
.sc-act .btn{width:100%;height:36px;justify-content:center;font-size:13px}
.sc-note{margin-top:12px;font-family:var(--mono);font-size:9.5px;color:var(--faint);text-align:center;letter-spacing:.03em}

/* 失效页 */
.err{width:100%;max-width:420px;text-align:center}
.err .code{font-family:var(--mono);font-size:52px;letter-spacing:.04em;color:var(--rule);line-height:1}
.err h2{font-size:18px;font-weight:600;margin:14px 0 6px}
.err p{font-size:12.5px;color:var(--muted);margin:0 0 22px;line-height:1.7}
.err .box{border:1px solid var(--rule);background:var(--surface);padding:12px 14px;text-align:left}
.err .box .row{display:flex;justify-content:space-between;padding:5px 0;font-size:11.5px}
.err .box .row span{color:var(--faint);font-family:var(--mono);font-size:10px;letter-spacing:.04em}
.err .box .row b{font-family:var(--mono);font-weight:400;font-size:11px;color:var(--ink-2)}

/* ---------- 移动端 ---------- */
@media(max-width:860px){
  .app{display:block}
  .rail{width:auto;flex:none;border-right:0;border-bottom:1px solid var(--rule);padding:16px 16px 0;
    position:static;height:auto}
  .brand-sub{margin-bottom:14px}
  .nav{flex-direction:row;gap:0;margin:0 -6px;overflow-x:auto}
  .nav button{border-left:0;border-bottom:2px solid transparent;padding:7px 10px;white-space:nowrap}
  .nav button.on{border-left:0;border-bottom-color:var(--accent);background:none}
  .nav .n{display:none}
  .rail-foot{display:flex;align-items:center;gap:12px;padding:10px 0;margin-top:0}
  .rail-foot div:first-child{flex:1;min-width:80px}
  .who{margin-top:0}
  main{padding:16px 16px 24px}
  .head h2{font-size:17px}
  .head .count{display:none}
  .drop .hint{display:none}
  .status .hide-sm{display:none}
  .savebar{margin:20px -16px -24px;padding:10px 16px}
  thead{display:none}
  table,tbody,tr,td{display:block}
  tbody tr{display:grid;grid-template-columns:18px 30px 1fr;column-gap:8px;row-gap:5px;align-items:center;
    padding:11px 0;border-bottom:1px solid var(--rule-soft)}
  tbody tr:hover{background:none}
  tbody td{height:auto;padding:0;border:0}
  tbody td:nth-child(1){grid-column:1;grid-row:1}
  tbody td:nth-child(2){grid-column:2;grid-row:1}
  tbody td:nth-child(3){grid-column:3;grid-row:1;min-width:0}
  tbody td:nth-child(4),tbody td:nth-child(5){display:none}
  tbody td:nth-child(6){grid-column:2 / 4;grid-row:2}
  #panel-bans tbody td:nth-child(4){display:none}
  #panel-bans tbody td:nth-child(5){grid-column:2 / 4;grid-row:2}
  #panel-shares .share-card{padding:12px 10px;gap:8px}
  .rowmeta{display:flex;margin-left:auto}
  .rtime{display:none}
  .ops{justify-content:flex-end}
  .field{flex-wrap:wrap;gap:8px}
  .field label{width:100%;flex:none}
  .uploader{left:12px;right:12px;width:auto;bottom:44px}
  .share-wrap{padding:0 16px 40px}
  .sa-head{padding:16px}
  .login-grid{grid-template-columns:1fr;gap:0}
  .login-side{display:none}
}
`;

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function page(title, body, script = '') {
  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#f4f2ec">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="apple-touch-icon" href="/favicon.svg">
<title>${esc(title)}</title>
<style>${CSS}</style></head>
<body>
${body}
<script>${script}</script></body></html>`;
}

const SEARCH_ICON =
  '<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5 14 14"/></svg>';

/* ==================== 登录页 ==================== */
export function loginHtml() {
  return page(
    '登录 · Filecove',
    `<div class="standalone">
  <div class="sa-head"><span class="wm">Filecove</span><span>PRIVATE DRIVE</span><span class="sp"></span><span>v${VERSION}</span></div>
  <div class="sa-body">
    <div class="login-grid">
      <div class="login">
        <div class="kicker">RESTRICTED</div>
        <h2>私人网盘</h2>
        <p class="sub">这个站点只对管理员开放。密码来自 Worker 的 <span class="mono">ADMIN_PASSWORD</span>。</p>
        <div id="hint"></div>
        <form id="f" onsubmit="login(event);return false">
          <label for="pwd">登录密码</label>
          <input id="pwd" type="password" placeholder="••••••••••••" autocomplete="current-password">
          <div class="hint">SESSION 12H · HTTPONLY</div>
          <button class="btn solid" id="btn" type="submit">登 录</button>
        </form>
        <div id="err"></div>
        <div class="foot"><span>Filecove ${VERSION}</span><a href="#" onclick="return false">忘记密码？改 Worker 变量</a></div>
      </div>
      <aside class="login-side">
        <div class="cap">INSTANCE</div>
        <div class="kv"><span>STORAGE</span><b id="i-store">—</b></div>
        <div class="kv"><span>BUCKET</span><b id="i-bucket">—</b></div>
        <div class="kv"><span>PROTOCOL</span><b id="i-proto">—</b></div>
        <div class="kv"><span>VERSION</span><b>v${VERSION}</b></div>
      </aside>
    </div>
  </div>
</div>`,
    `
var $hint=document.getElementById('hint'),$err=document.getElementById('err');
function show(el,cls,html){el.innerHTML='<div class="alert '+cls+'">'+html+'</div>';}
async function probe(){
  try{
    var r=await fetch('/api/status',{cache:'no-store'});
    var d=await r.json();
    document.getElementById('i-store').textContent=d.driver||'-';
    document.getElementById('i-bucket').textContent=d.bucket||'-';
    document.getElementById('i-proto').textContent=d.https?'HTTPS':'HTTP';
    if(!d.hasAdmin){
      show($hint,'bad','<b>还没设置登录密码</b><br>到 Workers → 设置 → 变量和机密，添加 <code>ADMIN_PASSWORD</code>（选「机密」）后重新部署。');
      document.getElementById('pwd').disabled=true;document.getElementById('btn').disabled=true;return;
    }
    if(!d.https){show($hint,'warn','<b>当前是 HTTP 访问</b><br>浏览器不会保存登录状态，请改用 HTTPS 打开本页。');}
    if(d.hasEnvAdmin&&d.hasDbAdmin){
      show($err,'warn','<code>ADMIN_PASSWORD</code> 已设置，它的优先级高于后台改过的密码，请用环境变量那个密码登录。');
    }
    if(d.admin){location.replace('/?_='+Date.now());return;}
    if(d.cookieState==='invalid'){
      show($hint,'bad','<b>登录状态未生效</b><br>浏览器发来了 Cookie，但 Worker 判定它无效。请清空本站 Cookie 后重新登录。');
    }
    var tried=false;try{tried=sessionStorage.getItem('fc_tried')==='1';}catch(e){}
    if(tried&&d.cookieState==='none'){
      show($hint,'bad','<b>浏览器没有保存登录状态</b><br>登录已成功，但 Cookie 没能写入。检查是否屏蔽了本站 Cookie、处于无痕模式，或装了隐私类扩展。');
      try{sessionStorage.removeItem('fc_tried');}catch(e){}
    }
  }catch(e){}
}
async function login(e){
  // async 函数返回 Promise（真值），光靠 return login() 阻止不了表单默认提交，
  // 浏览器会立刻原生导航把请求掐断，表现就是「刷新后又回到登录页」。
  if(e&&e.preventDefault)e.preventDefault();
  var pwd=document.getElementById('pwd').value;
  $err.innerHTML='';
  var r=await fetch('/api/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({password:pwd})});
  var d=await r.json().catch(function(){return {}});
  if(d.ok){
    try{sessionStorage.setItem('fc_tried','1');}catch(e){}
    location.replace('/?_='+Date.now());
    return false;
  }
  var html=d.reason==='no_password'?('<b>'+(d.msg||'还没设置登录密码')+'</b>'):(d.msg||('进不去（HTTP '+r.status+'）'));
  if(d.hint&&(d.hint.hasLeadingTrailingSpace||d.hint.hasLineBreak)){
    html+='<br><b>提示：</b>Worker 里存的密码首尾带空格或换行（长度 '+d.hint.length+'，去空白后 '+d.hint.trimmedLength+'）。删掉重新粘贴并重新部署。';
  }
  show($err,'bad',html);
  return false;
}
probe();
document.getElementById('pwd').focus();
`
  );
}

/* ==================== 分享页 ==================== */
export function shareHtml(o) {
  const name = o.share.file_name || '文件';
  const ext = (String(name).split('.').pop() || '?').toUpperCase().slice(0, 4);
  const sizeText = o.share.file_size ? fmtSize(o.share.file_size) : '—';
  const isImage = /^image\//i.test(o.share.file_mime || '') || /\.(jpe?g|png|gif|webp|avif|bmp|svg|heic|heif)$/i.test(name);
  const disabled = o.error || o.banned;

  const expireText = o.share.expires_at ? fmtFull(o.share.expires_at) : '永久';
  const limitText = o.share.max_downloads ? o.share.downloads + ' / ' + o.share.max_downloads + ' 次' : '不限次数';

  let gate = '';
  if (o.needPassword) {
    gate += '<div class="field-inline"><input type="password" id="pwd" placeholder="访问密码"></div>';
  }
  if (o.needTurnstile) {
    gate += '<div class="field-inline"><div id="cf-ts" style="flex:1"></div></div>';
  }

  // 图片直接铺预览；加载不出来就退回占位，不留破图
  const preview = !disabled && isImage
    ? '<div class="preview" id="pv"><img src="/raw/' + esc(o.code) + '" alt="" loading="lazy" onclick="zoomPrev()" onerror="prevFail()"></div>'
    : '<div class="preview">预览不可用 · 点击下载</div>';

  const btn = disabled
    ? '<button class="btn" disabled style="width:100%">' + esc(o.banned ? 'IP 已被限制' : o.error || '不可用') + '</button>'
    : '<button class="btn solid" onclick="start()">下 载</button>';

  const body = `<div class="standalone">
  <div class="sa-head"><span class="wm">Filecove</span><span>SHARE</span><span class="sp"></span><span>/s/${esc(o.code)}</span></div>
  <div class="sa-body" style="align-items:flex-start;padding-top:8px">
    <div class="share-wrap">
      <div class="share-card-lg">
        <div class="sc-head"><span class="ext">${esc(ext)}</span>
          <div class="t"><b>${esc(name)}</b><span>${esc(sizeText)} · ${esc(o.share.file_mime || '文件')}</span></div>
        </div>
        ${preview}
        <div class="sc-meta">
          <div class="row"><span>分享时间</span><b>${fmtFull(o.share.created_at)}</b></div>
          <div class="row"><span>有效期</span><b>${esc(expireText)}</b></div>
          <div class="row"><span>下载次数</span><b>${esc(limitText)}</b></div>
        </div>
        <div class="sc-act">${gate}${btn}</div>
      </div>
      <div class="sc-note">由 Filecove 提供 · 下载走直链 · 如遇问题请联系分享者</div>
    </div>
  </div>
</div>
<div class="lightbox" id="lightbox"></div>
<div class="toast" id="toast"></div>`;

  const script = `
var CODE='${o.code}';
var NEED_PWD=${o.needPassword ? 'true' : 'false'};
var NEED_TS=${o.needTurnstile ? 'true' : 'false'};
var tsToken='';
function toast(m){var t=document.getElementById('toast');t.textContent=m;t.classList.add('on');setTimeout(function(){t.classList.remove('on')},2000);}
function onTsLoad(){if(NEED_TS&&window.turnstile){turnstile.render('#cf-ts',{sitekey:'${o.turnstileSitekey}',callback:function(t){tsToken=t;}});}}
function prevFail(){
  var p=document.getElementById('pv');if(!p)return;
  var img=p.querySelector('img');
  if(img&&!img.getAttribute('data-retried')){
    img.setAttribute('data-retried','1');
    setTimeout(function(){img.src='/raw/'+CODE+'?r='+Date.now();},500);
    return;
  }
  p.className='preview';p.textContent='预览不可用 · 点击下载';
}
function zoomPrev(){
  var lb=document.getElementById('lightbox');if(!lb)return;
  lb.innerHTML='<img src="/raw/'+CODE+'" alt="">';
  lb.classList.add('on');
  lb.onclick=function(){lb.classList.remove('on');lb.innerHTML='';};
}
async function start(){
  var body={};
  if(NEED_PWD){var p=document.getElementById('pwd');body.password=p?p.value:'';}
  if(NEED_TS){body.turnstile=tsToken;}
  var r=await fetch('/s/'+CODE+'/unlock',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
  var d=await r.json().catch(function(){return {}});
  if(!d.ok){toast(d.msg||'验证失败');return;}
  location.href='/d/'+CODE;
}
`;

  const tsScript = o.needTurnstile
    ? '<script src="https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTsLoad&render=explicit" async defer></script>'
    : '';

  // 页脚脚本需要在 Turnstile 脚本之前，所以单独插入
  const full = page('分享 · ' + name, body, script);
  return tsScript ? full.replace('</body>', tsScript + '</body>') : full;
}

/* ==================== 错误 / 失效页 ==================== */
export function renderErrorPage(code, msg) {
  // 错误页是直接在路由里 return 的，必须返回 Response 而不是字符串
  const markup = page(
    code + ' · Filecove',
    `<div class="standalone">
  <div class="sa-head"><span class="wm">Filecove</span><span>ERROR</span><span class="sp"></span><span>${esc(code)}</span></div>
  <div class="sa-body">
    <div class="err">
      <div class="code">${esc(code)}</div>
      <h2>${esc(msg)}</h2>
      <p>${esc(code) === '404' ? '这个地址不存在。如果是别人给你的链接，可能已经失效或被取消。' : '分享已过期或被分享者取消。如果你需要这个文件，请联系分享者重新生成链接。'}</p>
      <div class="box">
        <div class="row"><span>状态</span><b>${esc(msg)}</b></div>
      </div>
      <a href="/" class="btn" style="margin-top:18px;width:100%;height:34px;justify-content:center;text-decoration:none">返回首页</a>
    </div>
  </div>
</div>`,
    ''
  );
  // 失效/不存在要带上对应状态码，便于客户端和爬虫判断
  const status = Number(code) || 200;
  return html(markup, status >= 400 && status < 600 ? status : 200);
}

/* ---------- 共用的小工具（服务端渲染时用） ---------- */
function fmtSize(n) {
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

function fmtFull(sec) {
  if (!sec) return '—';
  const d = new Date(sec * 1000);
  const p = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export { esc, page, fmtSize, fmtFull };

/* ==================== 管理后台 ==================== */
export function adminHtml(o) {
  const brandSub = `${esc(o.driver)} · ${esc(o.bucket)} · 直链`;

  const body = `<div class="app">
  <aside class="rail">
    <div class="brand"><h1>Filecove</h1><span>v${VERSION}</span></div>
    <div class="brand-sub">${brandSub}</div>

    <nav class="nav" id="nav">
      <button class="on" data-tab="files"><span class="no">01</span>文件<span class="n" id="n-files">—</span></button>
      <button data-tab="shares"><span class="no">02</span>分享<span class="n" id="n-shares">—</span></button>
      <button data-tab="logs"><span class="no">03</span>记录<span class="n" id="n-logs">—</span></button>
      <button data-tab="bans"><span class="no">04</span>封禁<span class="n" id="n-bans">—</span></button>
      <button data-tab="settings"><span class="no">05</span>设置</button>
    </nav>

    <div class="rail-foot">
      <div>
        <div class="meter-label"><span>已用</span><span id="usage">—</span></div>
        <div class="meter"><i id="usage-bar"></i></div>
      </div>
      <div class="who"><span class="dot"></span>admin<button id="logout">退出</button></div>
    </div>
  </aside>

  <main>
    <div class="head">
      <h2 id="title">文件</h2>
      <span class="count" id="count"></span>
      <span class="sp"></span>
      <div class="acts">
        <button class="btn" id="sync">同步桶内</button>
        <button class="btn solid" id="uploadBtn">上传</button>
      </div>
    </div>

    <!-- 文件 -->
    <section class="panel on" id="panel-files">
      <div class="toolbar">
        <div class="search">${SEARCH_ICON}<input id="search" placeholder="搜索文件名"></div>
        <span class="sp"></span>
        <span class="selinfo" id="selinfo">按时间排序 · 降序</span>
      </div>
      <div class="drop" id="drop">
        <span class="plus">+</span>
        <span>拖入文件，或点击选择</span>
        <span class="hint">单文件 ≤ 100 GB · 超过 100 MB 自动分片 · 支持多选</span>
      </div>
      <div id="fileList"><div class="empty">加载中…</div></div>
      <div id="moreBox"></div>
    </section>

    <!-- 分享 -->
    <section class="panel" id="panel-shares">
      <div class="toolbar">
        <span class="selinfo" id="shareinfo">—</span>
        <span class="sp"></span>
        <button class="btn sm" id="newShare">新建分享</button>
      </div>
      <div id="shareList"><div class="empty">加载中…</div></div>
      <p class="empty" style="padding:26px 0 0">分享链接访问时按当前域名拼接，换域名不用改记录。</p>
    </section>

    <!-- 记录 -->
    <section class="panel" id="panel-logs">
      <div class="toolbar">
        <div class="search">${SEARCH_ICON}<input id="logq" placeholder="按 IP 或文件名筛选"></div>
        <span class="sp"></span>
        <span class="selinfo" id="loginfo">最近记录</span>
      </div>
      <div id="logList"><div class="empty">加载中…</div></div>
    </section>

    <!-- 封禁 -->
    <section class="panel" id="panel-bans">
      <div class="toolbar">
        <span class="selinfo" id="baninfo">—</span>
        <span class="sp"></span>
        <button class="btn sm" id="addBan">手动封禁</button>
      </div>
      <div id="banList"><div class="empty">加载中…</div></div>
      <p class="empty" style="padding:26px 0 0">封禁由限流自动触发，也可以在记录页手动封禁。解封立即生效。</p>
    </section>

    <!-- 设置 -->
    <section class="panel" id="panel-settings">
      <div class="form" id="cfg"><div class="empty">加载中…</div></div>
      <div class="savebar">
        <span class="dot"></span><span id="saveState">在这里改会存进数据库，优先级高于环境变量</span>
        <span class="sp"></span>
        <button class="btn sm" id="reloadCfg">放弃</button>
        <button class="btn solid sm" id="saveCfg">保存</button>
      </div>
    </section>
  </main>
</div>

<div class="status">
  <div class="cell"><span class="ok"></span><span id="s-store">${esc(o.driver)} · ${esc(o.bucket)}</span></div>
  <div class="cell" id="s-mode">直链 —</div>
  <div class="cell hide-sm" id="s-base">未配置直链</div>
  <div class="sp"></div>
  <div class="cell hide-sm">D1 ok</div>
  <div class="cell">v${VERSION}</div>
</div>

<div class="uploader" id="uploader">
  <div class="u-head"><span>上传队列</span><span class="mono" id="u-count">0</span><span class="sp"></span>
    <button id="u-hide">收起</button></div>
  <div id="u-list"></div>
</div>

<div class="mask" id="mask"><div class="modal" id="modal"></div></div>
<div class="lightbox" id="lightbox"></div>
<div class="toast" id="toast"></div>
<input type="file" id="picker" multiple hidden>`;

  const script = `
var FILES=[],SHARES=[],LOGS=[],BANS=[],CFG={},CFG_SRC={},SEL={},Q='',LOGQ='';
var OFFSET=0,PAGE=100,DIRTY=false;
function $(id){return document.getElementById(id);}
function toast(m){var t=$('toast');t.textContent=m;t.classList.add('on');setTimeout(function(){t.classList.remove('on')},2000);}
function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function fmt(n){n=Number(n)||0;if(n<1024)return n+' B';var u=['KB','MB','GB','TB'],v=n/1024,i=0;while(v>=1024&&i<u.length-1){v/=1024;i++;}return v.toFixed(v>=100||i===0?0:1)+' '+u[i];}
function p2(x){return String(x).padStart(2,'0');}
function t2s(ts){if(!ts)return '—';var d=new Date(ts*1000);return p2(d.getMonth()+1)+'-'+p2(d.getDate())+' '+p2(d.getHours())+':'+p2(d.getMinutes());}
function t2full(ts){if(!ts)return '—';var d=new Date(ts*1000);return p2(d.getMonth()+1)+'-'+p2(d.getDate())+' '+p2(d.getHours())+':'+p2(d.getMinutes())+':'+p2(d.getSeconds());}
function t2long(ts){if(!ts)return '—';var d=new Date(ts*1000);return d.getFullYear()+'-'+p2(d.getMonth()+1)+'-'+p2(d.getDate())+' '+p2(d.getHours())+':'+p2(d.getMinutes());}
function extOf(n){var s=String(n||'');var i=s.lastIndexOf('.');return i>0?s.slice(i+1).toUpperCase().slice(0,4):'?';}
async function api(p,opt){
  opt=opt||{};opt.credentials='same-origin';
  if(opt.body&&typeof opt.body!=='string'){opt.headers=Object.assign({'content-type':'application/json'},opt.headers||{});opt.body=JSON.stringify(opt.body);}
  var r=await fetch(p,opt);
  if(r.status===401){location.reload();return null;}
  var d=await r.json().catch(function(){return {}});
  if(!r.ok){toast(d.msg||('请求失败 '+r.status));return null;}
  return d;
}
// 加载失败时给出可重试的提示，绝不让页面永远停在「加载中…」
function failBox(id,msg){
  var el=$(id);if(!el)return;
  el.innerHTML='<div class="empty">'+esc(msg)+'<div style="margin-top:10px"><button class="btn sm" onclick="location.reload()">重试</button></div></div>';
}
function copyText(t){if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(t).then(function(){toast('已复制')},function(){prompt('复制',t)});}else{prompt('复制',t);}}

/* ---------- 导航 ---------- */
var TITLES={files:'文件',shares:'分享',logs:'记录',bans:'封禁',settings:'设置'};
$('nav').addEventListener('click',function(e){
  var b=e.target.closest('button[data-tab]');if(!b)return;
  var name=b.getAttribute('data-tab');
  var bs=$('nav').querySelectorAll('button');
  for(var i=0;i<bs.length;i++){bs[i].classList.toggle('on',bs[i]===b);}
  var ps=document.querySelectorAll('.panel');
  for(var j=0;j<ps.length;j++){ps[j].classList.toggle('on',ps[j].id==='panel-'+name);}
  $('title').textContent=TITLES[name]||'';
  if(name==='files')loadFiles(true);
  if(name==='shares')loadShares();
  if(name==='logs')loadLogs();
  if(name==='bans')loadBans();
  if(name==='settings')loadCfg();
});
$('logout').onclick=async function(){await fetch('/api/logout',{method:'POST'});location.href='/';};

/* ---------- 统计 ---------- */
async function loadStats(){
  var d=await api('/api/stats');
  if(!d){$('usage').textContent='—';return;}
  $('n-files').textContent=d.files||0;
  $('n-shares').textContent=d.shares||0;
  $('n-logs').textContent=d.downloads||0;
  var used=Number(d.bytes)||0;
  $('count').textContent=(d.files||0)+' 个对象 · '+fmt(used);
  // 容量上限可在设置页改（默认按 R2 免费额度 10 GB），填 0 表示不显示进度
  var capGb=Number(d.quota)||0;
  if(capGb>0){
    var cap=capGb*1073741824,pct=Math.min(100,used/cap*100);
    $('usage-bar').style.width=pct.toFixed(2)+'%';
    $('usage').textContent=fmt(used)+' / '+fmt(cap);
  }else{
    $('usage-bar').style.width='0%';
    $('usage').textContent=fmt(used);
  }
}

/* ---------- 文件 ---------- */
var IMG_EXT=/\\.(jpe?g|png|gif|webp|avif|bmp|svg|heic|heif)$/i;
function isImg(f){return /^image\\//i.test(f.mime||'')||IMG_EXT.test(f.name||'');}
async function loadFiles(reset,retry){
  if(reset)OFFSET=0;
  var u='/api/files?limit='+PAGE;
  if(Q)u+='&q='+encodeURIComponent(Q);
  if(OFFSET)u+='&offset='+OFFSET;
  var d=await api(u);
  if(!d){
    // 先自动重试一次，仍失败才给提示（D1 冷启动偶尔会慢一下）
    if(!retry){await new Promise(function(r){setTimeout(r,600);});return loadFiles(reset,true);}
    failBox('fileList','文件列表加载失败');return;
  }
  FILES=(OFFSET?FILES:[]).concat(d.files||[]);SEL={};
  OFFSET=d.next||0;
  renderFiles();
}
function onSearch(){clearTimeout(window.__st);window.__st=setTimeout(function(){Q=($('search').value||'').trim();OFFSET=0;loadFiles(true);},280);}
$('search').addEventListener('input',onSearch);
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
$('sync').onclick=syncBucket;
// 缩略图加载不出来就换成类型标签，不留破图
// 首次失败先重试一次（换个 query 绕开缓存），再失败才退回后缀标签
function thumbFail(el){
  if(!el||!el.parentNode)return;
  var id=el.getAttribute('data-id');
  if(!el.getAttribute('data-retried')){
    el.setAttribute('data-retried','1');
    var t=setTimeout(function(){el.src='/preview/'+id+'?r='+Date.now();},400);
    el.setAttribute('data-timer',t);
    return;
  }
  var f=null;for(var i=0;i<FILES.length;i++){if(FILES[i].id===id)f=FILES[i];}
  var s=document.createElement('span');
  s.className='ext';s.textContent=extOf(f?f.name:'');
  el.parentNode.replaceChild(s,el);
}
function typeCell(f){
  if(isImg(f))return '<img class="thumb" src="/preview/'+esc(f.id)+'" alt="" data-id="'+esc(f.id)+'" onerror="thumbFail(this)">';
  return '<span class="ext">'+esc(extOf(f.name))+'</span>';
}
function renderFiles(){
  if(!FILES.length){$('fileList').innerHTML='<div class="empty">还没有文件，把文件拖到上面即可上传</div>';$('moreBox').innerHTML='';$('selinfo').textContent='按时间排序 · 降序';return;}
  var h='<table><thead><tr><th style="width:26px"></th><th style="width:34px">类型</th><th>文件名</th>'+
    '<th class="r" style="width:84px">大小</th><th class="r" style="width:132px">上传时间</th><th class="r" style="width:126px">操作</th></tr></thead><tbody>';
  for(var i=0;i<FILES.length;i++){
    var f=FILES[i];
    h+='<tr data-i="'+i+'"><td><span class="chk" data-act="toggle"></span></td>'+
      '<td>'+typeCell(f)+'</td>'+
      '<td><div class="fname"><b title="'+esc(f.name)+'">'+esc(f.name)+'</b>'+
      '<span class="rowmeta"><span class="rsize">'+fmt(f.size)+'</span><span class="rtime">'+t2s(f.uploaded_at)+'</span></span></div></td>'+
      '<td class="r"><span class="num">'+fmt(f.size)+'</span></td>'+
      '<td class="r"><span class="time">'+t2s(f.uploaded_at)+'</span></td>'+
      '<td><div class="ops"><button data-act="share">分享</button><span class="sep">·</span>'+
      '<button data-act="link">直链</button><span class="sep">·</span>'+
      '<button class="del" data-act="del">删除</button></div></td></tr>';
  }
  h+='</tbody></table>';
  $('fileList').innerHTML=h;
  bindRows();
  $('moreBox').innerHTML=OFFSET?'<div style="margin-top:12px"><button class="btn sm" id="moreBtn">加载更多</button></div>':'';
  if(OFFSET)$('moreBtn').onclick=loadMore;
  updateSel();
}
// 用事件委托绑定行内操作，避免在 HTML 属性里拼带引号的 JS 字符串
function bindRows(){
  var rows=$('fileList').querySelectorAll('tr[data-i]');
  for(var i=0;i<rows.length;i++){(function(tr){
    var idx=Number(tr.getAttribute('data-i'));
    var c=tr.querySelector('[data-act=toggle]');
    if(c)c.onclick=function(){tr.classList.toggle('checked');SEL[idx]=tr.classList.contains('checked');updateSel();};
    var bs=tr.querySelectorAll('.ops [data-act]');
    for(var j=0;j<bs.length;j++){(function(b){
      var act=b.getAttribute('data-act');
      b.onclick=function(){
        if(act==='share')openShare(idx);
        else if(act==='link')copyLink(idx);
        else if(act==='del')delFile(FILES[idx].id);
      };
    })(bs[j]);}
    var th=tr.querySelector('.thumb');
    if(th)th.onclick=function(){zoom(th.getAttribute('data-id'));};
  })(rows[i]);}
}
function updateSel(){
  var n=0;for(var k in SEL){if(SEL[k])n++;}
  if(n){$('selinfo').textContent='已选 '+n+' 项';
    if(!$('bulk')){var b=document.createElement('button');b.id='bulk';b.className='btn danger sm';b.textContent='删除所选';b.onclick=delSelected;$('selinfo').parentNode.appendChild(b);}
  }else{
    $('selinfo').textContent='按时间排序 · 降序';
    var old=$('bulk');if(old)old.remove();
  }
}
function selectedIds(){var ids=[];for(var k in SEL){if(SEL[k]&&FILES[k])ids.push(FILES[k].id);}return ids;}
async function delFile(id){if(!confirm('删除该文件？存储对象也会一并删除'))return;var d=await api('/api/files/delete',{method:'POST',body:{ids:[id]}});if(d){toast('已删除');loadFiles();loadStats();}}
async function delSelected(){var ids=selectedIds();if(!ids.length)return;if(!confirm('删除所选 '+ids.length+' 个文件？'))return;var d=await api('/api/files/delete',{method:'POST',body:{ids:ids}});if(d){toast('已删除');loadFiles();loadStats();}}
async function copyLink(i){
  var f=FILES[i];if(!f)return;
  var d=await api('/api/files/'+f.id+'/link');
  if(!d)return;
  if(!d.url){
    // 分两种：压根没配，还是配了但存储层没读到（多半是没重新部署）
    if(d.reason==='public_base_not_applied'){
      toast('已填了域名但没生效，重新部署一次');
      setTimeout(function(){document.querySelector('[data-tab=settings]').click();},600);
    }else{
      toast('还没配置公网域名');
      setTimeout(function(){document.querySelector('[data-tab=settings]').click();},600);
    }
    return;
  }
  copyText(d.url);
}
function zoom(id){
  var lb=$('lightbox');if(!lb)return;
  lb.innerHTML='<img src="/preview/'+esc(id)+'" alt="">';
  lb.classList.add('on');
  lb.onclick=function(){lb.classList.remove('on');lb.innerHTML='';};
}
$('lightbox').onclick=function(){this.classList.remove('on');this.innerHTML='';};

/* ---------- 上传 ---------- */
var queue=[],busy=false,done=[];
$('uploadBtn').onclick=function(){$('picker').click();};
$('drop').onclick=function(){$('picker').click();};
$('picker').addEventListener('change',function(e){for(var i=0;i<e.target.files.length;i++){queue.push(e.target.files[i]);}e.target.value='';runQueue();});
$('u-hide').onclick=function(){$('uploader').classList.remove('on');};
function renderUploader(){
  $('uploader').classList.add('on');
  $('u-count').textContent=String(done.length);
  var h='';
  for(var i=0;i<done.length;i++){var t=done[i];
    h+='<div class="u-item"><span class="ext">'+esc(extOf(t.name))+'</span><div class="u-body"><b>'+esc(t.name)+'</b>'+
       '<span class="u-bar"><i style="width:'+t.pct+'%"></i></span></div><span class="u-pct">'+(t.pct>=100?'完成':t.pct+'%')+'</span></div>';}
  $('u-list').innerHTML=h;
}
function setPct(idx,pct){done[idx].pct=Math.round(pct);renderUploader();}
function xhr(method,url,headers,blob,onProg){
  return new Promise(function(res,rej){
    var x=new XMLHttpRequest();x.open(method,url,true);
    for(var k in headers){x.setRequestHeader(k,headers[k]);}
    x.upload.onprogress=function(e){if(e.lengthComputable&&onProg)onProg(e.loaded/e.total);};
    x.onload=function(){if(x.status>=200&&x.status<300){res(x);}else{rej(new Error('HTTP '+x.status));}};
    x.onerror=function(){rej(new Error('网络错误'));};
    x.send(blob);
  });
}
async function runQueue(){
  if(busy)return;busy=true;done=[];
  while(queue.length){
    var f=queue.shift();
    var idx=done.length;done.push({name:f.name,pct:0});renderUploader();
    try{await uploadOne(f,idx);setPct(idx,100);}catch(err){toast('上传失败：'+err.message);done[idx].pct=0;renderUploader();}
  }
  busy=false;loadFiles(true);loadStats();
}
async function uploadOne(file,idx){
  var r=await api('/api/upload/presign',{method:'POST',body:{name:file.name,size:file.size,mime:file.type||'application/octet-stream'}});
  if(!r)throw new Error('获取上传凭证失败');
  if(r.mode==='direct'){
    await xhr('PUT',r.url,{'content-type':file.type||'application/octet-stream'},file,function(p){setPct(idx,p*100);});
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
        setPct(idx,Math.min(98,uploaded.length/parts*100));
      }
    }
    await Promise.all(Array.from({length:Math.min(CONC,parts)},partWorker));
    uploaded.sort(function(a,b){return a.PartNumber-b.PartNumber;});
    await api('/api/upload/multipart/complete',{method:'POST',body:{key:r.key,uploadId:r.uploadId,parts:uploaded,fileId:r.fileId}});
  }else{
    await xhr('PUT',r.url,{'content-type':file.type||'application/octet-stream'},file,function(p){setPct(idx,p*100);});
    await api('/api/upload/confirm',{method:'POST',body:{fileId:r.fileId,size:file.size}});
  }
}
function initDrop(){
  var z=$('drop');
  ['dragenter','dragover'].forEach(function(e){z.addEventListener(e,function(ev){ev.preventDefault();z.classList.add('on');});});
  ['dragleave','drop'].forEach(function(e){z.addEventListener(e,function(ev){ev.preventDefault();z.classList.remove('on');});});
  z.addEventListener('drop',function(ev){var fs=ev.dataTransfer.files;for(var i=0;i<fs.length;i++){queue.push(fs[i]);}runQueue();});
}

/* ---------- 分享 ---------- */
function closeModal(){$('mask').classList.remove('on');$('modal').innerHTML='';}
$('mask').addEventListener('click',function(e){if(e.target===$('mask'))closeModal();});
document.addEventListener('keydown',function(e){if(e.key==='Escape')closeModal();});
$('newShare').onclick=function(){
  if(!FILES.length){toast('先切到文件页加载列表');return;}
  openShare(0,true);
};
function openShare(i,pick){
  var f=FILES[i];
  var opts=FILES.map(function(x,k){return '<option value="'+k+'"'+(k===i?' selected':'')+'>'+esc(x.name)+'</option>';}).join('');
  $('modal').innerHTML=
   '<div class="modal-h"><h3>创建分享</h3><button class="x" onclick="closeModal()">×</button></div>'+
   '<div class="modal-b">'+
   '<div class="row"><label>文件</label><select id="m-file">'+opts+'</select></div>'+
   '<div class="row"><label>有效期</label><select id="m-exp">'+
     '<option value="0">永久</option><option value="3600">1 小时</option><option value="86400">1 天</option>'+
     '<option value="604800">7 天</option><option value="2592000">30 天</option></select></div>'+
   '<div class="row"><label>密码</label><input id="m-pwd" placeholder="可选"><span class="unit">留空则不需要</span></div>'+
   '<div class="row"><label>次数</label><input id="m-max" type="number" value="0" min="0"><span class="unit">次 · 0 不限</span></div>'+
   '</div>'+
   '<div class="modal-f"><button class="btn" onclick="closeModal()">取消</button>'+
   '<button class="btn solid" id="m-create">创建</button></div>';
  $('m-create').onclick=function(){createShare(Number($('m-file').value));};
  $('mask').classList.add('on');
}
async function createShare(idx){
  var f=FILES[idx];if(!f)return;
  var d=await api('/api/shares',{method:'POST',body:{file_id:f.id,
    password:$('m-pwd').value,expires_in:Number($('m-exp').value),max_downloads:Number($('m-max').value)||0}});
  if(!d)return;
  $('modal').innerHTML=
   '<div class="modal-h"><h3>分享已创建</h3><button class="x" onclick="closeModal()">×</button></div>'+
   '<div class="modal-b"><div class="sec-title" style="margin:0 0 6px">链接</div>'+
   '<div class="linkbox"><input id="m-link" readonly value="'+esc(d.url)+'">'+
   '<button onclick="copyText(document.getElementById(\\'m-link\\').value)">复制</button></div>'+
   '<div class="sec-title" style="margin:14px 0 6px">直链</div>'+
   '<div class="linkbox"><input id="m-dl" readonly value="'+esc(d.url)+'"><button id="m-dlbtn">取直链</button></div></div>'+
   '<div class="modal-f"><button class="btn" onclick="closeModal()">关闭</button>'+
   '<button class="btn solid" onclick="closeModal();document.querySelector(\\'[data-tab=shares]\\').click()">查看分享</button></div>';
  $('m-dlbtn').onclick=async function(){
    var r=await api('/direct/'+esc(d.code));if(r&&r.url){$('m-dl').value=r.url;copyText(r.url);}
  };
  $('mask').classList.add('on');
  loadShares();
}
async function loadShares(){
  var d=await api('/api/shares');
  if(!d){failBox('shareList','分享列表加载失败');return;}
  SHARES=d.shares||[];
  $('shareinfo').textContent=SHARES.length+' 条分享';
  if(!SHARES.length){$('shareList').innerHTML='<div class="empty">还没有分享链接</div>';return;}
  var h='';
  for(var i=0;i<SHARES.length;i++){var s=SHARES[i];
    var lim=s.max_downloads?(s.downloads+' / '+s.max_downloads+' 次'):('已下载 '+s.downloads);
    var exp=s.expires_at?t2long(s.expires_at):'永久';
    h+='<div class="share-card" data-i="'+i+'"><span class="code">/s/'+esc(s.code)+'</span>'+
      '<span class="meta">'+esc(s.name)+(s.password_hash?' · 密码':'')+'</span><span class="sp"></span>'+
      '<span class="meta">'+esc(exp)+' · '+esc(lim)+'</span>'+
      '<button class="linkbtn" data-act="copy">复制</button>'+
      '<button class="linkbtn" data-act="direct" style="color:var(--ink-2)">直链</button>'+
      '<button class="linkbtn" data-act="del" style="color:var(--danger);text-decoration-color:#e3cfc9">取消</button></div>';
  }
  $('shareList').innerHTML=h;
  var cards=$('shareList').querySelectorAll('.share-card');
  for(var j=0;j<cards.length;j++){(function(card){
    var s=SHARES[Number(card.getAttribute('data-i'))];
    var bs=card.querySelectorAll('[data-act]');
    for(var k=0;k<bs.length;k++){(function(b){
      var act=b.getAttribute('data-act');
      b.onclick=function(){
        if(act==='copy')copyText(s.url);
        else if(act==='direct')copyDirect(s.code);
        else if(act==='del')delShare(s.code);
      };
    })(bs[k]);}
  })(cards[j]);}
}
async function copyDirect(code){var d=await api('/direct/'+code);if(d&&d.url)copyText(d.url);}
async function delShare(code){if(!confirm('删除这个分享链接？'))return;var d=await api('/api/shares/delete',{method:'POST',body:{code:code}});if(d){toast('已删除');loadShares();loadStats();}}

/* ---------- 记录 ---------- */
async function loadLogs(){
  var d=await api('/api/logs');
  if(!d){failBox('logList','下载记录加载失败');return;}
  LOGS=d.logs||[];
  $('loginfo').textContent='最近 '+LOGS.length+' 条';
  renderLogs();
}
$('logq').addEventListener('input',function(){LOGQ=($('logq').value||'').trim().toLowerCase();renderLogs();});
function renderLogs(){
  var arr=LOGS.filter(function(l){
    if(!LOGQ)return true;
    return String(l.ip||'').toLowerCase().indexOf(LOGQ)>=0||String(l.name||l.code||'').toLowerCase().indexOf(LOGQ)>=0;
  });
  if(!arr.length){$('logList').innerHTML='<div class="empty">暂无记录</div>';return;}
  var h='<table><thead><tr><th style="width:140px">时间</th><th style="width:140px">IP</th><th style="width:70px">地区</th>'+
    '<th>动作</th><th class="r" style="width:80px">大小</th><th class="r" style="width:60px">操作</th></tr></thead><tbody>';
  for(var i=0;i<arr.length;i++){var l=arr[i];
    h+='<tr data-i="'+i+'"><td><span class="time">'+t2full(l.ts)+'</span></td>'+
      '<td><span class="num">'+esc(l.ip)+'</span></td><td><span class="mono">'+esc(l.country||'—')+'</span></td>'+
      '<td>'+esc(l.action==='download'?'下载':(l.action||'访问'))+' · '+esc(l.name||l.code||'')+'</td>'+
      '<td class="r"><span class="num">'+(l.bytes?fmt(l.bytes):'—')+'</span></td>'+
      '<td class="r"><div class="ops"><button data-act="ban">封</button></div></td></tr>';
  }
  h+='</tbody></table>';
  $('logList').innerHTML=h;
  var rows=$('logList').querySelectorAll('tr[data-i]');
  for(var j=0;j<rows.length;j++){(function(tr){
    var l=arr[Number(tr.getAttribute('data-i'))];
    var b=tr.querySelector('[data-act=ban]');
    if(b)b.onclick=function(){banIp(l.ip);};
  })(rows[j]);}
}
async function banIp(ip){
  var m=prompt('封禁 '+ip+' 多少分钟？',CFG.banMinutes||60);
  if(!m)return;
  var d=await api('/api/bans',{method:'POST',body:{ip:ip,minutes:Number(m)||60,reason:'管理员手动封禁'}});
  if(d){toast('已封禁');loadBans();}
}

/* ---------- 封禁 ---------- */
async function loadBans(){
  var d=await api('/api/bans');
  if(!d){failBox('banList','封禁列表加载失败');return;}
  BANS=d.bans||[];
  $('baninfo').textContent=BANS.length+' 个 IP 处于封禁中';
  $('n-bans').textContent=BANS.length;
  if(!BANS.length){$('banList').innerHTML='<div class="empty">当前没有封禁记录</div>';return;}
  var h='<table><thead><tr><th style="width:150px">IP</th><th style="width:70px">来源</th><th>原因</th>'+
    '<th style="width:132px">解除时间</th><th class="r" style="width:60px">操作</th></tr></thead><tbody>';
  for(var i=0;i<BANS.length;i++){var b=BANS[i];
    h+='<tr data-i="'+i+'"><td><span class="num">'+esc(b.ip)+'</span></td>'+
      '<td><span class="mono">'+esc((b.reason||'').indexOf('管理员')>=0?'手动':'自动')+'</span></td>'+
      '<td>'+esc(b.reason||'—')+'</td><td><span class="time">'+t2long(b.until)+'</span></td>'+
      '<td class="r"><div class="ops"><button data-act="unban">解封</button></div></td></tr>';
  }
  h+='</tbody></table>';
  $('banList').innerHTML=h;
  var rows=$('banList').querySelectorAll('tr[data-i]');
  for(var j=0;j<rows.length;j++){(function(tr){
    var b=BANS[Number(tr.getAttribute('data-i'))];
    var btn=tr.querySelector('[data-act=unban]');
    if(btn)btn.onclick=function(){unban(b.ip);};
  })(rows[j]);}
}
async function unban(ip){var d=await api('/api/bans/unban',{method:'POST',body:{ip:ip}});if(d){toast('已解封');loadBans();}}
$('addBan').onclick=function(){
  var ip=prompt('要封禁的 IP：');
  if(!ip)return;
  banIp(ip.trim());
};

/* ---------- 设置 ---------- */
function srcTag(k){
  var m=(CFG_SRC||{})[k];if(!m)return '';
  return '<span class="src">'+esc(m)+'</span>';
}
function field(label,desc,ctrl,src){
  return '<div class="field"><label>'+label+(desc?'<div class="desc">'+desc+'</div>':'')+(src?srcTag(src):'')+'</label>'+ctrl+'</div>';
}
function numInput(id,val,unit,extra){
  return '<input id="'+id+'" type="text" value="'+esc(val)+'"'+(extra||'')+'>'+(unit?'<span class="unit">'+unit+'</span>':'');
}
async function loadCfg(){
  var d=await api('/api/config');
  if(!d){failBox('cfg','设置加载失败');return;}
  CFG=d.config||{};CFG_SRC=d.sources||{};
  var c=CFG;
  var modes=[['auto','auto — 有公网域名走直链'],['public','public — 强制直链'],['signed','signed — 预签名（15 分钟）'],['proxy','proxy — Worker 代理']];
  var modeSel='<select id="c-mode">'+modes.map(function(m){
    return '<option value="'+m[0]+'"'+(c.downloadMode===m[0]?' selected':'')+'>'+m[1]+'</option>';}).join('')+'</select>';
  var ton=c.turnstileEnabled;
  $('cfg').innerHTML=
   '<div class="sec-title">直链与下载</div>'+
   field('公网域名','对象存储的公开访问域名',
     numInput('c-base',c.publicBaseUrl||'','')+
     '<button class="btn sm" id="btn-check">检测</button>','PUBLIC_BASE_URL')+
   '<div id="chk" style="padding:0 0 4px"></div>'+
   field('下载方式','',modeSel,'DOWNLOAD_MODE')+
   '<div class="sec-title">限流与防刷</div>'+
   field('单 IP 下载上限','',numInput('c-ipmax',c.ipMaxDownloads,'次 /',' style="max-width:64px"')+numInput('c-win',c.ipWindowSeconds,'秒',' style="max-width:64px"'),'IP_MAX_DOWNLOADS')+
   field('超限封禁时长','',numInput('c-ban',c.banMinutes,'分钟',' style="max-width:64px"'),'BAN_MINUTES')+
   field('月度流量上限','超出后拒绝下载，0 为不限',numInput('c-traffic',(c.monthlyTrafficLimit/1073741824).toFixed(2),'GB',' style="max-width:64px"'),'MONTHLY_TRAFFIC_LIMIT')+
   '<div class="sec-title">人机验证</div>'+
   field('Turnstile','分享页下载前过一次验证','<button class="switch'+(ton?' on':'')+'" id="c-ton"></button><span class="unit" id="c-ton-txt">'+(ton?'已开启':'已关闭')+'</span>')+
   field('Sitekey','',numInput('c-tkey',c.turnstileSitekey||'',''),'TURNSTILE_SITEKEY')+
   field('Secret','',numInput('c-tsec',c.turnstileSecret||'',''),'TURNSTILE_SECRET')+
   '<div class="sec-title">上传</div>'+
   field('单文件上限','',numInput('c-umax',Math.round(c.uploadMaxSize/1073741824),'GB',' style="max-width:64px"'),'UPLOAD_MAX_SIZE')+
   field('分片阈值','超过这个大小走分片直传',numInput('c-mth',Math.round(c.multipartThreshold/1048576),'MB',' style="max-width:64px"'),'MULTIPART_THRESHOLD')+
   field('分片大小','',numInput('c-mps',Math.round(c.multipartPartSize/1048576),'MB',' style="max-width:64px"'),'MULTIPART_THRESHOLD')+
   '<div class="sec-title">存储</div>'+
   field('驱动','切到 S3 需要把下面四项填全',
     '<select id="c-driver">'+[['auto','auto — 有 S3 配置用 S3，否则 R2 绑定'],['r2','r2 — 只用 R2 绑定'],['s3','s3 — 只用 S3 兼容']].map(function(m){
       return '<option value="'+m[0]+'"'+(c.storageDriver===m[0]?' selected':'')+'>'+m[1]+'</option>';}).join('')+'</select>','STORAGE_DRIVER')+
   field('R2 桶名','R2 绑定模式下仅用于显示',numInput('c-r2b',c.r2BucketName||'',''),'R2_BUCKET_NAME')+
   field('容量上限','只影响侧栏进度条，填 0 不显示',numInput('c-quota',c.storageQuotaGb||0,'GB',' style="max-width:64px"'),'STORAGE_QUOTA_GB')+
   field('S3 Endpoint','B2 / COS / OSS / MinIO / R2 的 S3 API 地址',numInput('c-s3e',c.s3Endpoint||'',''),'S3_ENDPOINT')+
   field('S3 桶','',numInput('c-s3b',c.s3Bucket||'',''),'S3_BUCKET')+
   field('S3 区域','R2 填 auto',numInput('c-s3r',c.s3Region||'auto',''),'S3_REGION')+
   field('S3 Access Key','留空则不改动'+(c.s3HasKey?'（已设置）':''),'<input id="c-s3ak" type="text" placeholder="留空不改" style="max-width:220px">')+
   field('S3 Secret Key','留空则不改动','<input id="c-s3sk" type="password" placeholder="留空不改" style="max-width:220px">')+
   '<div class="sec-title">管理员</div>'+
   field('登录密码','留空表示不修改','<input id="c-pwd" type="password" placeholder="留空不改" style="max-width:220px">');
  if($('btn-check'))$('btn-check').onclick=checkBase;
  var sw=$('c-ton');
  sw.onclick=function(){var on=sw.classList.toggle('on');$('c-ton-txt').textContent=on?'已开启':'已关闭';markDirty();};
  var ids=['c-base','c-mode','c-ipmax','c-win','c-ban','c-traffic','c-tkey','c-tsec','c-pwd',
           'c-umax','c-mth','c-mps','c-driver','c-r2b','c-s3e','c-s3b','c-s3r','c-s3ak','c-s3sk','c-quota'];
  for(var i=0;i<ids.length;i++){var el=$(ids[i]);if(el)el.addEventListener('input',markDirty);if(el&&el.tagName==='SELECT')el.addEventListener('change',markDirty);}
  DIRTY=false;updateSave();
  $('s-mode').textContent='直链 '+(c.downloadMode||'auto');
  $('s-base').textContent=c.publicBaseUrl?c.publicBaseUrl.replace(/^https?:\\/\\//,''):'未配置直链';
}
// 检测：填了域名但直链还是生成不出来时，用它判断到底生效没有
async function checkBase(){
  var box=$('chk');if(!box)return;
  box.innerHTML='<div class="muted">检测中…</div>';
  var d=await api('/api/diag/link');
  if(!d){box.innerHTML='';return;}
  var txt='',cls='alert warn';
  if(d.reason==='no_public_base'){cls='alert warn';txt='还没填公网域名。填了才有对象直链（不填也能用，下载会走预签名地址）。';}
  else if(d.reason==='public_base_not_applied'){
    cls='alert bad';
    txt='<b>已填了域名，但存储层没读到。</b>配置是从数据库读的，'+
        '最常见的原因是还没重新部署。去 Actions 再跑一次，然后回来看这里。';
  }
  else{
    cls='alert';
    txt='<b>直链已生效。</b>下载会直接跳到 <code>'+esc(d.effectiveBase||d.configuredBase||'')+'</code>。'+
        (d.sample?'<br>示例：'+esc(d.sample):'')+
        '<br>如果点开示例是 404，说明这个域名在存储桶上没有开公开访问，需要到桶的「公共访问」里绑定。';
  }
  box.innerHTML='<div class="'+cls+'" style="margin:2px 0 8px">'+txt+'</div>';
}
function markDirty(){DIRTY=true;updateSave();}
function updateSave(){$('saveState').textContent=DIRTY?'有未保存的改动':'在这里改会存进数据库，优先级高于环境变量';}
$('saveCfg').onclick=async function(){
  var ton=$('c-ton')?$('c-ton').classList.contains('on'):false;
  var d=await api('/api/config',{method:'POST',body:{
    publicBaseUrl:$('c-base').value,downloadMode:$('c-mode').value,
    ipMaxDownloads:Number($('c-ipmax').value)||30,ipWindowSeconds:Number($('c-win').value)||3600,
    banMinutes:Number($('c-ban').value)||60,
    monthlyTrafficLimit:Math.round((Number($('c-traffic').value)||0)*1073741824),
    turnstileSitekey:$('c-tkey').value,turnstileSecret:$('c-tsec').value,
    turnstileEnabled:ton,adminPassword:$('c-pwd').value,
    uploadMaxSize:Math.round((Number($('c-umax').value)||100)*1073741824),
    multipartThreshold:Math.round((Number($('c-mth').value)||100)*1048576),
    multipartPartSize:Math.round((Number($('c-mps').value)||16)*1048576),
    storageDriver:$('c-driver').value,r2BucketName:$('c-r2b').value,
    storageQuotaGb:Number($('c-quota').value)||0,
    s3Endpoint:$('c-s3e').value,s3Bucket:$('c-s3b').value,s3Region:$('c-s3r').value,
    s3AccessKeyId:$('c-s3ak').value,s3SecretAccessKey:$('c-s3sk').value}});
  if(d){toast('设置已保存');DIRTY=false;loadCfg();}
};
$('reloadCfg').onclick=function(){loadCfg();};

/* ---------- 启动 ---------- */
initDrop();
loadStats();
loadFiles(true);
loadShares();
loadBans();
loadCfg();
`;

  return page('Filecove · 私人网盘', body, script);
}
