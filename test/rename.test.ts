// 改名相关的防回归测试。
// 项目从 Filecove 改名为 Cloudrive 时，有几处「看似该改、改了就出事」的地方，
// 这里把它们钉住，避免以后有人顺手统一命名把功能弄坏。
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'vitest';
import assert from 'node:assert/strict';

const ROOT = join(__dirname, '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

const auth = read('src/auth.ts');

test('密码哈希的 pepper 保持 filecove 不变', () => {
  // 它是已存 admin_hash 的一部分。改成新名字后，数据库里旧的密码哈希
  // 全部对不上，表现为「密码明明对却登不进去」。
  assert.match(
    auth,
    /sha256Hex\(`\$\{salt\}:\$\{password\}:filecove`\)/,
    'pepper 被改动了，已存密码会全部失效'
  );
});

test('会话密钥默认值保持 filecove 不变', () => {
  // 改动会让所有已登录会话立即失效（全员被登出）。
  assert.match(
    auth,
    /'filecove-default-secret'/,
    '会话密钥默认值被改动了，已登录会话会失效'
  );
});

test('部署脚本有旧资源名的迁移兼容逻辑', () => {
  // 老用户的桶/库叫 filecove，里面是他们的文件。
  // 重新部署时必须先找 filecove 并复用，不能因为改了名就重建一个空桶。
  const setup = read('scripts/setup-resources.mjs');
  assert.match(setup, /LEGACY_RESOURCE_NAME\s*=\s*'filecove'/, '缺 LEGACY_RESOURCE_NAME = filecove');
  assert.match(setup, /NEW_RESOURCE_NAME\s*=\s*'cloudrive'/, '缺 NEW_RESOURCE_NAME = cloudrive');

  // 探测顺序必须是「新名 → 旧名」，否则老用户会被误判成新用户
  const order = setup.indexOf('NEW_RESOURCE_NAME, LEGACY_RESOURCE_NAME');
  assert.ok(order > 0, '探测顺序不是 新名 → 旧名');
});

test('Worker 名已改为 cloudrive', () => {
  const toml = read('wrangler.toml');
  // 第一个 name 就是 Worker 名（在 [build] 之前）
  assert.match(toml, /^name\s*=\s*"cloudrive"/m, 'wrangler.toml 的 Worker 名不是 cloudrive');

  const wf = read('.github/workflows/deploy.yml');
  assert.match(wf, /CF_WORKER_NAME:\s*cloudrive/, '工作流里的 Worker 名没改');
});

test('首屏注入变量名三处一致（page.ts / App.vue / main.ts）', () => {
  const page = read('src/page.ts');
  const app = read('web/src/App.vue');
  const main = read('web/src/main.ts');

  // 服务端注入
  assert.match(page, /window\.__CLOUDRIVE__=/, 'src/page.ts 没有注入 window.__CLOUDRIVE__');
  // 前端读取
  assert.match(app, /window\.__CLOUDRIVE__/, 'App.vue 读的不是 __CLOUDRIVE__');
  assert.match(main, /__CLOUDRIVE__\?:/, 'main.ts 的类型声明不是 __CLOUDRIVE__');
  // 不能还留着旧名字，否则前端拿到空 boot
  for (const [f, src] of [['src/page.ts', page], ['web/src/App.vue', app], ['web/src/main.ts', main]] as const) {
    assert.ok(!src.includes('__FILECOVE__'), `${f} 里还有旧的 __FILECOVE__`);
  }
});

test('界面上不再出现旧品牌名 Filecove', () => {
  for (const f of [
    'src/page.ts',
    'src/share.ts',
    'web/src/views/AdminView.vue',
    'web/src/views/LoginView.vue',
    'web/src/views/ShareView.vue',
    'web/index.html',
  ]) {
    const src = read(f);
    assert.ok(!src.includes('Filecove'), `${f} 里还写着 Filecove`);
  }
});

test('文档里的 Worker 名已改，资源名保持', () => {
  const readme = read('README.md');
  assert.ok(!/Workers\s*→\s*`?filecove/i.test(readme), 'README 里还有指向旧 Worker 名的操作步骤');
  assert.match(readme, /cloudrive/, 'README 里没有新名字');
});
