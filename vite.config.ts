import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath, URL } from 'node:url';

// 前端（Vue3 + Tailwind）单独构建，产物由 scripts/embed-assets.mjs 内联进 Worker，
// 这样部署仍然只有一个 Worker 入口，不需要静态资源绑定。
export default defineConfig({
  root: fileURLToPath(new URL('./web', import.meta.url)),
  plugins: [vue()],
  build: {
    outDir: '../web/dist',
    emptyOutDir: true,
    // 单文件输出，方便整段内联
    assetsInlineLimit: 0,
    rollupOptions: {
      output: {
        entryFileNames: 'app.js',
        assetFileNames: 'app.[ext]',
      },
    },
  },
});
