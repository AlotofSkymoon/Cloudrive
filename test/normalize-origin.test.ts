// 验证「直链域名规范化」——修的是图里那个 404
// 只填 v6.cc.cd 时，拼出来的 URL 没有 scheme，浏览器会按当前路径解析成
// /d/v6.cc.cd/... 这种不存在的路径，直接 404。
import { test } from 'vitest';
import assert from 'node:assert/strict';
import { normalizeOrigin } from '../src/util';

test('裸域名自动补 https', () => {
  assert.equal(normalizeOrigin('v6.cc.cd'), 'https://v6.cc.cd');
});

test('已有 https 前缀时原样保留并去掉尾部斜杠', () => {
  assert.equal(normalizeOrigin('https://cdn.example.com'), 'https://cdn.example.com');
  assert.equal(normalizeOrigin('https://cdn.example.com/'), 'https://cdn.example.com');
  assert.equal(normalizeOrigin('https://cdn.example.com///'), 'https://cdn.example.com');
});

test('保留 http 与自定义端口', () => {
  assert.equal(normalizeOrigin('http://127.0.0.1:9000'), 'http://127.0.0.1:9000');
});

test('带路径时只取 origin', () => {
  assert.equal(normalizeOrigin('https://cdn.example.com/bucket'), 'https://cdn.example.com');
});

test('首尾空白被去掉', () => {
  assert.equal(normalizeOrigin('  cdn.example.com  '), 'https://cdn.example.com');
});

test('空值与非法输入返回空字符串', () => {
  assert.equal(normalizeOrigin(''), '');
  assert.equal(normalizeOrigin('   '), '');
  assert.equal(normalizeOrigin('ftp://x.com'), '');
  assert.equal(normalizeOrigin('https://'), '');
});
