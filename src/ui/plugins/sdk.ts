/**
 * 宿主插件 SDK：暴露给第三方「预编译插件包」的全局接口。
 *
 * 设计（app 式插件化）：第三方用仓库模板把组件编译为自包含 IIFE，构建时
 * externalize vue 并改用本 SDK 暴露的 vue 运行时 + 注册接口，产物不打包 Vue，
 * 从而与宿主共用同一运行时，避免多实例问题。插件包通过同源 <script src>
 * （HA /local 目录）或 blob: URL 注入后，调用 SnoozePanelPluginAPI.registerFace /
 * registerWidget 注册自身。
 *
 * 红线：本 SDK 不发起任何网络请求，也不执行外发行为；仅在内存注册表中登记。
 */

import * as Vue from 'vue';
import { registerRuntimeFace } from '@/ui/faces/registry';
import { registerRuntimeWidget } from '@/ui/widgets/registry';
import * as clockCore from '@/core/clock';
import * as lunarCore from '@/core/lunar';
import * as textCore from '@/core/text';
import * as templateCore from '@/core/template';
import type { FacePluginMeta, WidgetPluginMeta } from './types';

/** 当前插件 SDK 版本（插件清单 apiVersion 需匹配） */
export const PLUGIN_API_VERSION = 1;

/** 宿主暴露给插件的 Vue 运行时子集（避免插件自带 Vue 造成多实例） */
const vueApi = {
  defineComponent: Vue.defineComponent,
  h: Vue.h,
  ref: Vue.ref,
  computed: Vue.computed,
  reactive: Vue.reactive,
  watch: Vue.watch,
  onMounted: Vue.onMounted,
  onBeforeUnmount: Vue.onBeforeUnmount,
  nextTick: Vue.nextTick,
  useId: Vue.useId,
};

/** 宿主暴露给插件的纯函数核心（clock / lunar / text / template 命名空间） */
const coreApi = Object.freeze({
  clock: clockCore,
  lunar: lunarCore,
  text: textCore,
  template: templateCore,
});

/** 最近一次注册结果（供加载器校验注入是否成功） */
export interface PluginRegisterResult {
  id: string;
  kind: 'face' | 'widget';
  isNew: boolean;
}

/** 全局插件 SDK 形状 */
export interface SnoozePanelPluginApi {
  apiVersion: number;
  vue: typeof vueApi;
  core: typeof coreApi;
  registerFace(meta: FacePluginMeta): void;
  registerWidget(meta: WidgetPluginMeta): void;
  /** 加载器内部使用：注入脚本前记录期望 id，注册回调时用于校验 */
  __expect: { id: string } | null;
  /** 加载器内部使用：最近一次注册结果 */
  __last: PluginRegisterResult | null;
}

declare global {
  interface Window {
    SnoozePanelPluginAPI?: SnoozePanelPluginApi;
  }
}

/** 安装（或返回已安装的）全局插件 SDK；幂等 */
export function installPluginSDK(): SnoozePanelPluginApi {
  if (window.SnoozePanelPluginAPI) return window.SnoozePanelPluginAPI;
  const api: SnoozePanelPluginApi = {
    apiVersion: PLUGIN_API_VERSION,
    vue: vueApi,
    core: coreApi,
    __expect: null,
    __last: null,
    registerFace(meta: FacePluginMeta): void {
      if (!meta || typeof meta.id !== 'string' || !meta.component) {
        throw new Error('[SnoozePanel] registerFace 参数非法：需要 { id, label, kind, component }');
      }
      const isNew = registerRuntimeFace(meta);
      api.__last = { id: meta.id, kind: 'face', isNew };
    },
    registerWidget(meta: WidgetPluginMeta): void {
      if (!meta || typeof meta.type !== 'string' || typeof meta.style !== 'string' || !meta.component) {
        throw new Error('[SnoozePanel] registerWidget 参数非法：需要 { type, style, label, component }');
      }
      const isNew = registerRuntimeWidget(meta);
      api.__last = { id: `${meta.type}/${meta.style}`, kind: 'widget', isNew };
    },
  };
  window.SnoozePanelPluginAPI = api;
  return api;
}

/** 获取已安装 SDK（未安装返回 undefined） */
export function getPluginSDK(): SnoozePanelPluginApi | undefined {
  return window.SnoozePanelPluginAPI;
}
