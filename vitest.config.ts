import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
    // e2e 里会起本地 mock 服务，串行跑更稳
    fileParallelism: false,
  },
});
