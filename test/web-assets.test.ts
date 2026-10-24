// 前端构建产物的守卫。
//
// 起因：src/web-assets.ts 是构建产物，却被提交进了仓库。本地装不上依赖，
// 构建跑不了，那份产物就一直停在几个月前的状态——标题还是旧项目名、
// 图标是通用云朵、断点是老的 860/900/1100。构建步骤一旦没执行，
// 部署出去的就是那份旧界面，而且**完全看不出异常**：页面能打开、
// 功能也都在，只是悄悄落后了好几个版本。
//
// 静默失败是最糟的失败方式。这里钉住两件事：
//   1. 仓库里那份只能是哨兵占位，不能是"看似可用的旧产物"
//   2. 没构建时页面要给出明确提示，而不是空白或旧界面
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'vitest';
import assert from 'node:assert/strict';

const ROOT = join(__dirname, '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

const SENTINEL = '__CLOUDRIVE_ASSETS_NOT_BUILT__';

// 注意：CI 的顺序是 build → typecheck → test，跑到 test 时
// src/web-assets.ts 已经被真产物覆盖了。所以这里两条路都要认：
// 仓库状态（哨兵）和构建后状态（真产物），分别断言该有的性质。
const SRC = read('src/web-assets.ts');
const IS_SENTINEL = SRC.includes(SENTINEL);

test('web-assets.ts 处于合法状态：仓库里是哨兵，构建后是真产物', () => {
  if (IS_SENTINEL) {
    // 真产物不该进仓库——进了就会在下一次构建失败时被当成
    // 「可用版本」部署出去，这正是本次要防的静默失败
    assert.match(SRC, new RegExp(`APP_JS\\s*=\\s*'${SENTINEL}'`), 'APP_JS 应该是哨兵值');
    assert.match(SRC, new RegExp(`APP_CSS\\s*=\\s*'${SENTINEL}'`), 'APP_CSS 应该是哨兵值');
    assert.ok(SRC.length < 4000, `占位文件不该这么大（${SRC.length} 字节），是不是把真产物提交进来了`);
  } else {
    // 构建过了：应该是个体积正常的真产物
    assert.ok(SRC.length > 10000, `构建产物只有 ${SRC.length} 字节，看着不对`);
    assert.match(SRC, /export const APP_JS/, '缺 APP_JS 导出');
    assert.match(SRC, /export const APP_CSS/, '缺 APP_CSS 导出');
  }
});

test('构建产物不含旧版痕迹', () => {
  // 旧项目名（出现在渲染文本里才算，注释里提到不算）
  assert.ok(!/>Filecove</.test(SRC), '产物里还有旧项目名的标题');
  // 品牌图标不能退化成 M3 通用云朵（拖拽区的上传图标除外，它是功能图标）
  const uploadIcon = /M19\.35 10\.04[^"]*ZM14 13v4h-4v-4H7/;
  assert.ok(!/M19\.35 10\.04/.test(SRC.replace(uploadIcon, '')), '产物里还是通用云朵图标');
  // 旧断点（v1.6.0 已统一成 compact / stacked / inline）
  assert.ok(!/max-\[(860|900|1100)px\]/.test(SRC), '产物里还有旧断点');
  // 新品牌名要真的在里面（哨兵状态下没有，跳过）
  if (!IS_SENTINEL) assert.ok(/Cloudrive/.test(SRC), '产物里找不到新品牌名');
});

test('page.ts 能识别未构建状态并给出说明页', () => {
  const page = read('src/page.ts');
  assert.match(page, /ASSETS_BUILT/, '没有构建状态判断');
  // 必须走 String() 转换：构建后 APP_JS 是具体字面量类型，
  // 直接和哨兵字面量比会被 tsc 判成无重叠（TS2367）
  assert.match(page, /String\(APP_JS\) !== /, '哨兵比对要包一层 String()，否则 tsc 会报 TS2367');
  // spaHtml 在没构建时要返回提示页，而不是照常吐空壳
  assert.match(page, /if \(!ASSETS_BUILT\)/, 'spaHtml 没有拦截未构建状态');
  assert.match(page, /function notBuiltHtml/, '缺说明页');
  // 提示页要给可执行的修复步骤
  assert.match(page, /npm run build/, '说明页没告诉用户要执行什么');
});

test('构建脚本会把哨兵覆盖掉', () => {
  const s = read('scripts/embed-assets.mjs');
  assert.match(s, /APP_JS|APP_CSS/, '构建脚本没有写入 APP_JS / APP_CSS');
  assert.match(s, /web-assets\.ts/, '构建脚本没有写 src/web-assets.ts');
});
