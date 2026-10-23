// 页面内联脚本必须能被解析。
// 曾因为 thumbCell 里在 HTML 属性中内联带引号的 JS 字符串，转义写坏后整段脚本报废，
// 页面卡在「加载中…」不动 —— 这个测试就是要挡住这类问题。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { adminHtml, loginHtml, shareHtml } from '../src/ui.js';

function scriptsOf(html) {
  return [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
}
function checkAll(name, html) {
  const list = scriptsOf(html);
  assert.ok(list.length > 0, `${name} 里没找到内联脚本`);
  for (const code of list) {
    try {
      new Function(code);
    } catch (e) {
      assert.fail(`${name} 的内联脚本无法解析：${e.message}`);
    }
  }
}

test('后台页内联脚本可解析', () => {
  checkAll('后台页', adminHtml({ driver: 'R2 绑定', bucket: 'filecove' }));
});

test('登录页内联脚本可解析', () => {
  checkAll('登录页', loginHtml());
});

test('分享页内联脚本可解析（图片 / 密码 / 人机验证三种形态）', () => {
  const base = {
    code: 'abcd1234',
    share: { file_name: 'a.jpg', file_size: 1234, file_mime: 'image/jpeg', created_at: Math.floor(Date.now() / 1000) },
    error: '', banned: false, turnstileSitekey: '',
  };
  checkAll('分享页-普通图片', shareHtml({ ...base, needPassword: false, needTurnstile: false }));
  checkAll('分享页-带密码', shareHtml({ ...base, needPassword: true, needTurnstile: false }));
  checkAll('分享页-带人机验证', shareHtml({ ...base, needPassword: false, needTurnstile: true }));
  checkAll('分享页-非图片', shareHtml({ ...base, share: { ...base.share, file_name: 'a.zip', file_mime: 'application/zip' }, needPassword: false, needTurnstile: false }));
});

// 缩略图的 onerror 不能再内联带引号的 HTML，否则又会写坏脚本
test('缩略图不使用内联 HTML 字符串的 onerror', () => {
  const html = adminHtml({ driver: 'R2', bucket: 'f' });
  const code = scriptsOf(html)[0];
  assert.ok(!/outerHTML\s*=/.test(code), 'onerror 里不应再赋值 outerHTML');
  assert.ok(/function thumbFail/.test(code), '应有 thumbFail 兜底函数');
});

// 请求失败时不能永远停在「加载中…」，要给出可重试的提示
test('列表请求失败时有失败提示，不会一直显示加载中', () => {
  const code = scriptsOf(adminHtml({ driver: 'R2', bucket: 'f' }))[0];
  assert.ok(/function failBox/.test(code), '应有 failBox');
  for (const [fn, id] of [['loadFiles', 'fileList'], ['loadShares', 'shareList'], ['loadLogs', 'logList'], ['loadBans', 'banList'], ['loadCfg', 'cfg']]) {
    const re = new RegExp('function ' + fn + '\\([\\s\\S]{0,700}?failBox\\(');
    assert.ok(re.test(code), `${fn} 失败时应调用 failBox 提示`);
  }
});
