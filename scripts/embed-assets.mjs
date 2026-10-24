/**
 * 把前端构建产物（Vue3 app + Tailwind CSS）内联成 TS 模块。
 *
 * 这样做的好处：部署仍然只有一个 Worker 入口，不需要静态资源绑定，
 * 也就不必依赖 Workers Assets 或 Pages —— 页面完全由 Worker 自己吐出来。
 *
 * 产物：src/web-assets.ts（自动生成，请勿手改）
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'web', 'dist');
const OUT = join(ROOT, 'src', 'web-assets.ts');

// 转成 TS 字符串字面量：注意转义反引号、反斜杠和 ${}
function toLiteral(s) {
  return s.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
}

const jsPath = join(DIST, 'app.js');
const cssPath = join(DIST, 'app.css');

if (!existsSync(jsPath) || !existsSync(cssPath)) {
  console.error('× 找不到前端产物，先跑一次：npm run build:web');
  console.error(`  期望存在：${jsPath}`);
  console.error(`  期望存在：${cssPath}`);
  process.exit(1);
}

const js = readFileSync(jsPath, 'utf8');
const css = readFileSync(cssPath, 'utf8');

const out = `// 自动生成，请勿手改 —— 由 scripts/embed-assets.mjs 从 web/dist 生成
// 前端（Vue3 + Tailwind）的构建产物，内联后 Worker 无需静态资源绑定。

export const APP_JS = \`${toLiteral(js)}\`;

export const APP_CSS = \`${toLiteral(css)}\`;
`;

writeFileSync(OUT, out);
console.log(`• 已内联前端产物 → src/web-assets.ts（JS ${(js.length / 1024).toFixed(1)} KB，CSS ${(css.length / 1024).toFixed(1)} KB）`);
