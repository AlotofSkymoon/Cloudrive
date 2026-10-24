// 验证「配置存在数据库里」：首次运行补默认值，且改过的值不被覆盖
import { test } from 'vitest';
import assert from 'node:assert/strict';
import { FakeD1 } from './minid1';

const { seedConfig, envWithSettings, allSettings } = await import('../src/db.js');

test('首次运行会把默认配置写进数据库', async () => {
  const env = { DB: new FakeD1() };
  await seedConfig(env);
  const s = await allSettings(env);
  assert.equal(s.DOWNLOAD_MODE, 'auto');
  assert.equal(s.IP_MAX_DOWNLOADS, '30');
  assert.equal(s.BAN_MINUTES, '60');
  assert.equal(s.STORAGE_DRIVER, 'auto');
  assert.equal(s.TURNSTILE_ENABLED, '0');
});

test('已有值不会被种子覆盖', async () => {
  const env = { DB: new FakeD1() };
  await seedConfig(env);
  await env.DB.prepare('UPDATE settings SET v = ? WHERE k = ?').bind('999', 'IP_MAX_DOWNLOADS').run();
  await seedConfig(env);
  const s = await allSettings(env);
  assert.equal(s.IP_MAX_DOWNLOADS, '999', '用户改过的值不该被重置');
});

test('数据库里的值会合并进 env，读 env.X 就能拿到', async () => {
  const env = { DB: new FakeD1(), DOWNLOAD_MODE: 'proxy', IP_MAX_DOWNLOADS: '5' };
  await seedConfig(env);
  await env.DB.prepare('UPDATE settings SET v = ? WHERE k = ?').bind('7', 'IP_MAX_DOWNLOADS').run();
  const merged = await envWithSettings(env);
  assert.equal(merged.IP_MAX_DOWNLOADS, '7', '数据库优先');
  assert.equal(merged.DOWNLOAD_MODE, 'auto', '未改过的用种子默认值');
});

test('ADMIN_PASSWORD 不被数据库覆盖（环境变量优先级更高）', async () => {
  const env = { DB: new FakeD1(), ADMIN_PASSWORD: 'from-env' };
  await env.DB.prepare('INSERT INTO settings (k, v, updated_at) VALUES (?, ?, ?)').bind('ADMIN_PASSWORD', 'from-db', 0).run();
  const merged = await envWithSettings(env);
  assert.equal(merged.ADMIN_PASSWORD, 'from-env');
});

test('没有设置表内容时原样返回 env', async () => {
  const env = { DB: new FakeD1(), X: '1' };
  const merged = await envWithSettings(env);
  assert.equal(merged.X, '1');
});
