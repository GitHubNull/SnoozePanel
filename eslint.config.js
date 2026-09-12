// @ts-check
/**
 * ESLint 扁平配置（ESLint 10，项目为 ESM）。
 *
 * 覆盖范围：
 *  - src/**：TypeScript 与 Vue 单文件组件（typescript-eslint + eslint-plugin-vue）
 *  - dev/**：本地实测页脚本（浏览器环境；JS 类型检查由 tsconfig.dev.json 负责）
 *  - 工程配置文件（*.config.ts / 本文件）：Node 环境
 * 忽略：tmp/（构建产物与临时文件）、node_modules/、dist/ 等
 *
 * 模块化约束：手写源码（src/**、dev/**、工程配置）单文件不得超过 520 行；
 * 超限一律以模块化方式拆分（见 max-lines 规则块）。
 */
import js from '@eslint/js';
import globals from 'globals';
import pluginVue from 'eslint-plugin-vue';
import tseslint from 'typescript-eslint';

// eslint-plugin-vue 各版本的 flat 预设入口兼容取用
const vueRecommended =
  pluginVue.configs['flat/recommended'] ?? pluginVue.configs.recommended ?? [];

export default tseslint.config(
  // ---- 忽略目录（构建产物 / 依赖 / 临时目录）----
  { ignores: ['tmp/**', 'node_modules/**', 'dist/**', 'coverage/**'] },

  // ---- 通用 JS 推荐规则 ----
  js.configs.recommended,

  // ---- TypeScript 推荐规则 ----
  ...tseslint.configs.recommended,

  // ---- Vue 推荐规则（flat 预设）----
  ...vueRecommended,

  // ---- Vue 单文件组件：<script lang="ts"> 交给 TS 解析器 ----
  {
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
      },
    },
    rules: {
      // 规则校准：关闭纯排版类规则。
      // 仓库模板刻意保持紧凑排版（SVG 表盘属性极多，逐属性换行会严重牺牲可读性），
      // 且未引入 Prettier 等格式化工具；此处保留正确性/最佳实践规则，仅豁免排版维度。
      'vue/max-attributes-per-line': 'off',
      'vue/singleline-html-element-content-newline': 'off',
      'vue/multiline-html-element-content-newline': 'off',
      'vue/html-indent': 'off',
      'vue/html-closing-bracket-newline': 'off',
      'vue/first-attribute-linebreak': 'off',
      'vue/html-quotes': 'off',
      'vue/html-self-closing': 'off',
      // 表盘入口统一为 faces/<id>/index.vue（注册表目录约定），豁免该命名检查
      'vue/multi-word-component-names': ['error', { ignores: ['index'] }],
    },
  },

  // ---- 源码：浏览器环境 ----
  {
    files: ['src/**/*.ts', 'src/**/*.vue'],
    languageOptions: {
      globals: { ...globals.browser },
    },
  },

  // ---- dev 实测页：浏览器环境 ----
  {
    files: ['dev/**/*.js'],
    languageOptions: {
      globals: { ...globals.browser },
    },
  },

  // ---- 工程配置文件：Node 环境 ----
  {
    files: ['*.config.ts', 'eslint.config.js'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },

  // ---- 模块化约束：手写源码单文件 ≤ 520 行 ----
  // 覆盖 src（TS/Vue）、dev 实测页脚本与工程配置文件；超限须以模块化方式拆分。
  {
    files: [
      'src/**/*.{ts,vue}',
      'dev/**/*.js',
      '*.config.ts',
      'eslint.config.js',
    ],
    rules: {
      'max-lines': ['error', 520],
    },
  },
);
