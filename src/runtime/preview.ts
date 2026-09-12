/**
 * 表盘缩略预览的挂载封装（DOM 层）。
 *
 * 供非 Vue 环境使用：dev 实测页通过 window.SnoozePanelTestApi.mountFacePreview 调用。
 * 内部为 FacePreview.vue 的 createApp 生命周期包装——用 h() 渲染函数串联响应式参数，
 * 保证表盘 / 主题热切换即时生效；模块加载期无任何副作用。
 */

import { createApp, h, reactive, type App } from 'vue';
import FacePreview from '@/ui/components/FacePreview.vue';

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
