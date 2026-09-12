/**
 * 表盘缩略预览的挂载封装（DOM 层）。
 *
 * 供非 Vue 环境使用：dev 实测页通过 window.SnoozePanelTestApi.mountFacePreview 调用。
 * 内部为 FacePreview.vue 的 createApp 生命周期包装——用 h() 渲染函数串联响应式参数，
 * 保证表盘 / 主题热切换即时生效；模块加载期无任何副作用。
 */

import { createApp, h, reactive, type App } from 'vue';
import FacePreview from '@/ui/components/FacePreview.vue';
import ScreensaverApp from '@/ui/ScreensaverApp.vue';
import type { SnoozeConfig } from '@/core/types';
import { normalizeConfig } from '@/core/config';
import type { HassLike } from '@/core/hass';

/** 预览参数（均可选；缺省：深夜主题、显示秒、24 小时制、绘制主题背景） */
export interface FacePreviewOptions {
  /** 主题：midnight（深色）/ paper（浅色） */
  theme?: 'midnight' | 'paper';
  /** 是否显示秒 */
  seconds?: boolean;
  /** 是否 24 小时制 */
  hour24?: boolean;
  /** 是否绘制主题背景 */
  showBackground?: boolean;
  /** 放大系数（1 = 完整显示全屏画面；>1 放大表盘、裁剪边缘，用于大预览看清细节） */
  zoom?: number;
}

/** 预览句柄：热切换参数 / 彻底卸载 */
export interface FacePreviewHandle {
  /** 切换表盘并更新参数（未提供的参数保持现值） */
  update(faceId: string, opts?: FacePreviewOptions): void;
  /** 卸载并移除渲染内容 */
  destroy(): void;
}

/** 预览响应式状态（内部使用） */
interface PreviewState {
  faceId: string;
  theme: 'midnight' | 'paper';
  seconds: boolean;
  hour24: boolean;
  showBackground: boolean;
  zoom: number;
}

/** 把提供的可选参数合并进状态（未提供则保持现值） */
function mergeOptions(state: PreviewState, opts: FacePreviewOptions): void {
  if (opts.theme !== undefined) state.theme = opts.theme;
  if (opts.seconds !== undefined) state.seconds = opts.seconds;
  if (opts.hour24 !== undefined) state.hour24 = opts.hour24;
  if (opts.showBackground !== undefined) state.showBackground = opts.showBackground;
  if (opts.zoom !== undefined) state.zoom = opts.zoom;
}

/**
 * 在指定宿主元素内挂载表盘实时预览。
 * @param host  宿主容器（尺寸由调用方 CSS 决定，预览自动 contain 缩放）
 * @param faceId  表盘 id（未注册时回退默认表盘）
 * @param opts  预览参数
 * @returns 预览句柄（update / destroy）
 */
export function mountFacePreview(
  host: HTMLElement,
  faceId: string,
  opts: FacePreviewOptions = {},
): FacePreviewHandle {
  const state = reactive<PreviewState>({
    faceId,
    theme: 'midnight',
    seconds: true,
    hour24: true,
    showBackground: true,
    zoom: 1,
  });
  mergeOptions(state, opts);

  const app: App = createApp({
    setup() {
      return () =>
        h(FacePreview, {
          faceId: state.faceId,
          theme: state.theme,
          seconds: state.seconds,
          hour24: state.hour24,
          showBackground: state.showBackground,
          zoom: state.zoom,
        });
    },
  });
  app.mount(host);

  return {
    update(nextFaceId: string, nextOpts: FacePreviewOptions = {}): void {
      state.faceId = nextFaceId;
      mergeOptions(state, nextOpts);
    },
    destroy(): void {
      app.unmount();
    },
  };
}

/** 完整屏保预览参数 */
export interface ScreensaverPreviewOptions {
  /** 设备 id（仅用于屏保右下角标识展示，不影响逻辑） */
  deviceId?: string;
}

/** 完整屏保预览句柄：热更新配置 / 彻底卸载 */
export interface ScreensaverPreviewHandle {
  /** 用新配置热更新预览（同一挂载实例，不重建） */
  update(config: SnoozeConfig): void;
  /** 卸载并移除渲染内容 */
  destroy(): void;
}

/**
 * 在指定宿主元素内挂载完整屏保预览（内嵌阅览模式：相对定位铺满宿主，无拖拽手柄）。
 * 供 dev 实测页用作「阅览画布」：随配置草稿热更新，所见即屏保最终效果。
 * @param host  宿主容器（尺寸由调用方 CSS 决定）
 * @param config  初始配置
 * @param hass  HA 实体上下文（提供 now 走内置 1s ticker）
 * @param opts  预览参数
 * @returns 预览句柄（update / destroy）
 */
export function mountScreensaverPreview(
  host: HTMLElement,
  config: SnoozeConfig,
  hass: HassLike,
  opts: ScreensaverPreviewOptions = {},
): ScreensaverPreviewHandle {
  const deviceId = opts.deviceId ?? 'preview';
  // 单一响应式状态：now 每秒推进，config 可整体替换（统一走 normalizeConfig，与运行时一致）
  const state = reactive({ config: normalizeConfig(config), now: new Date(), hass });
  const timer = setInterval(() => {
    state.now = new Date();
  }, 1000);

  const app: App = createApp({
    setup() {
      return () => h(ScreensaverApp, { config: state.config, deviceId, previewMode: true });
    },
  });
  // ScreensaverApp 通过 inject('snoozeState') 获取 now / hass
  app.provide('snoozeState', state);
  app.mount(host);

  return {
    update(next: SnoozeConfig): void {
      state.config = normalizeConfig(next);
    },
    destroy(): void {
      clearInterval(timer);
      app.unmount();
    },
  };
}
