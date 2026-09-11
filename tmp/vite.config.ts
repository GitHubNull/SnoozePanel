import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
// 源码在 ../src（仓库根的 src/），产物输出到 tmp/dist/
const srcRoot = resolve(here, '../src');

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': srcRoot,
    },
  },
  build: {
    outDir: resolve(here, 'dist'),
    emptyOutDir: true,
    // 单文件产物：内联所有动态导入与 CSS
    cssCodeSplit: false,
    assetsInlineLimit: 100 * 1024 * 1024,
    lib: {
      entry: resolve(srcRoot, 'main.ts'),
      name: 'SnoozePanel',
      formats: ['iife'],
      fileName: () => 'snoozepanel.js',
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
    minify: 'esbuild',
  },
});
