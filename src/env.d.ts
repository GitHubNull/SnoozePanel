/// <reference types="vite/client" />

/**
 * .vue 单文件组件的模块声明。
 *
 * vite/client 的类型不包含 `*.vue`：纯 `tsc --noEmit`（以及编辑器内置 TS 服务）
 * 需要本声明才能识别 `import App from './App.vue'` 形式的导入。
 * vue-tsc 原生支持 .vue，不依赖本声明，二者可同时使用。
 */
declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>;
  export default component;
}
