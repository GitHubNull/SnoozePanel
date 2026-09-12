/**
 * 插件包构建配置（供 scripts/build-plugin.mjs 调用）。
 *
 * 把第三方插件工程编译为自包含 IIFE 插件包（index.js），关键约定：
 *   - external: ['vue'] + globals: { vue: 'SnoozePanelPluginAPI.vue' }：
 *     产物不打包 Vue，改用宿主注入的全局 SDK 上的 Vue 运行时，避免多实例；
 *   - format: 'iife'：单文件自包含，可由同源 <script src> 或 blob: 直接注入；
 *   - CSS 注入 JS：不产出独立 .css，保持插件包单文件。
 *
 * 入参经环境变量传入（由 scripts/build-plugin.mjs 设置）：
 *   - PLUGIN_DIR：插件工程根目录（含 src/index.ts 与 plugin.json），相对仓库根解析；
 *   - PLUGIN_OUT：产物输出目录（拷贝 plugin.json + index.js），绝对路径优先；
 *     缺省为 <PLUGIN_DIR>/dist。
 *
 * 说明：本配置不设置 root，默认以仓库根为 root；入口/输出均为绝对路径。
 */
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import cssInjectedByJs from 'vite-plugin-css-injected-by-js';
import { resolve } from 'node:path';

const root = process.cwd();
const pluginDir = resolve(root, process.env.PLUGIN_DIR || 'plugin-template');
const outDir = process.env.PLUGIN_OUT || resolve(pluginDir, 'dist');

export default defineConfig({
  // 支持插件作者以 .vue 单文件组件编写；纯 TS 工程同样适用
  plugins: [vue(), cssInjectedByJs()],
  // 浏览器环境无 process，替换依赖中的环境变量引用
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
    'process.env': '{}',
    __VUE_OPTIONS_API__: 'true',
    __VUE_PROD_DEVTOOLS__: 'false',
    __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: 'false',
  },
  build: {
    outDir,
    emptyOutDir: true,
    // 单文件产物：内联动态导入与 CSS
    cssCodeSplit: false,
    assetsInlineLimit: 100 * 1024 * 1024,
    lib: {
      entry: resolve(pluginDir, 'src/index.ts'),
      name: 'SnoozePanelPlugin',
      formats: ['iife'],
      fileName: () => 'index.js',
    },
    rollupOptions: {
      // 复用宿主 Vue 运行时：不打包 Vue，改用全局 SDK 暴露的实例
      external: ['vue'],
      output: {
        globals: { vue: 'SnoozePanelPluginAPI.vue' },
        inlineDynamicImports: true,
      },
    },
    minify: 'esbuild',
  },
});
