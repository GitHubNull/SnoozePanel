import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const srcRoot = resolve(here, '../src');

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': srcRoot,
    },
  },
  // 允许 vite 访问 root(tmp) 之外的 ../src 源码
  server: {
    fs: {
      allow: [here, resolve(here, '..')],
    },
  },
  test: {
    environment: 'jsdom',
    // root 保持 tmp（node_modules 所在），include 用相对 root 的 glob 指向 ../src/tests
    include: ['../src/tests/**/*.spec.ts'],
    globals: true,
  },
});
