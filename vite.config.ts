import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import cssInjectedByJs from 'vite-plugin-css-injected-by-js';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
// 工程根即仓库根，源码在 src/；构建产物属临时文件，输出到 tmp/dist/
const srcRoot = resolve(here, 'src');

export default defineConfig({
  // 单文件产物：CSS 注入 JS，不单独产出 .css
  plugins: [vue(), cssInjectedByJs()],
  // 浏览器环境无 process，替换 Vue/PrimeVue 中的环境变量引用
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
    'process.env': '{}',
    __VUE_OPTIONS_API__: 'true',
    __VUE_PROD_DEVTOOLS__: 'false',
    __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: 'false',
  },
  resolve: {
    alias: {
      '@': srcRoot,
    },
    preserveSymlinks: false,
    mainFields: ['module', 'main', 'browser'],
    dedupe: ['vue'],
  },
  build: {
    outDir: resolve(here, 'tmp/dist'),
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
