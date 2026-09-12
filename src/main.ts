/**
 * SnoozePanel 入口。
 *
 * 作为 HA「资源」（resource）加载的单文件 JS：
 *  - 注册 `snooze-panel` 自定义元素（视图级门控载体）
 *  - 注册可视化配置编辑器（card GUI editor）
 *  - 注册 `snooze-panel-sidebar` 侧边栏入口元素（panel_custom 协议）
 *  - 向 window.customCards 声明，便于 HA 卡片选择器识别
 *  - 暴露 window.SnoozePanelTestApi（本地实测页 / 自动化验证支撑，只读、无副作用）
 */

import { registerSnoozePanel } from './panel';
import { registerSnoozePanelEditor } from './editor/editor';
import { registerSnoozePanelSidebar } from './sidebar/sidebar';
import { listFaceOptions, type FaceOption } from './ui/faces/registry';
import { mountFacePreview, type FacePreviewHandle, type FacePreviewOptions } from './runtime/preview';
import type { SnoozeConfig } from './core/types';
import type { HassLike } from './core/hass';

registerSnoozePanel();
registerSnoozePanelEditor();
registerSnoozePanelSidebar();

// 向 HA 卡片选择器声明
interface CustomCardEntry {
  type: string;
  name: string;
  description: string;
  preview?: boolean;
}

/**
 * 本地实测支撑 API（仅供 dev/ 实测页与自动化验证消费）。
 *
 * 设计约束：只读、无副作用、无任何外发请求；不属于插件业务接口，
 * 生产自动化请勿依赖。类型与实现见 registry.listFaceOptions / runtime.preview。
 */
interface SnoozePanelTestApi {
  /** 列出全部表盘（纯数据：id / 中文名 / 种类 / 来源） */
  listFaces(): FaceOption[];
  /** 在宿主元素内挂载表盘实时缩略预览（返回句柄用于热切换 / 卸载） */
  mountFacePreview(host: HTMLElement, faceId: string, opts?: FacePreviewOptions): FacePreviewHandle;
  /** 在宿主元素内挂载完整配置编辑器（dev 页用，返回句柄用于读取配置 / 卸载） */
  mountEditor(host: HTMLElement, config: SnoozeConfig, hass: HassLike): EditorHandle;
}

/** 编辑器挂载句柄（dev 页用） */
interface EditorHandle {
  /** 读取当前编辑器内的配置草稿 */
  getConfig(): SnoozeConfig;
  /** 卸载编辑器 */
  destroy(): void;
}

declare global {
  interface Window {
    customCards?: CustomCardEntry[];
    SnoozePanelTestApi?: SnoozePanelTestApi;
  }
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: 'snooze-panel',
  name: 'SnoozePanel 屏保',
  description: '在所属视图启用闲置屏保（时钟/日历/农历/天气/背景）。配置写在视图 snoozepanel: 段。',
  preview: false,
});

/**
 * 在宿主元素内挂载完整配置编辑器（dev 页用）。
 * 内部创建 snooze-panel-editor 元素并桥接 config-changed 事件。
 */
function mountEditor(host: HTMLElement, config: SnoozeConfig, hass: HassLike): EditorHandle {
  const el = document.createElement('snooze-panel-editor') as HTMLElement & {
    setConfig(config: Record<string, unknown>): void;
    hass: HassLike;
  };
  let currentConfig = config;

  el.hass = hass;
  el.setConfig({ snoozepanel: config });

  el.addEventListener('config-changed', (ev) => {
    const detail = (ev as CustomEvent).detail as { config?: { snoozepanel?: SnoozeConfig } };
    if (detail.config?.snoozepanel) {
      currentConfig = detail.config.snoozepanel;
    }
  });

  host.appendChild(el);

  return {
    getConfig(): SnoozeConfig {
      return currentConfig;
    },
    destroy(): void {
      el.remove();
    },
  };
}

window.SnoozePanelTestApi = Object.freeze({
  listFaces: listFaceOptions,
  mountFacePreview,
  mountEditor,
} satisfies SnoozePanelTestApi);

console.info(
  '%c SnoozePanel %c 已加载 ',
  'background:#5ea0ff;color:#fff;padding:2px 4px;border-radius:3px 0 0 3px',
  'background:#223;color:#fff;padding:2px 4px;border-radius:0 3px 3px 0',
);
