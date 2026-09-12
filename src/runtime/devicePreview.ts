/**
 * 独立「模拟设备显示面板」的挂载封装（DOM 层）。
 *
 * 供非 Vue 环境使用：dev 实测页通过 window.SnoozePanelTestApi.mountDevicePreview 调用，
 * 亦支撑自动化验证。内部以 createApp 渲染 DevicePreview.vue，并 provide 自带时间源的
 * snoozeState（Ticker 驱动 now），使其成为可独立存在、自含时钟的模拟设备面板。
 *
 * 模块加载期无任何副作用；只读、无外发请求。
 */

import { createApp, h, reactive, type App } from 'vue';
import DevicePreview from '@/ui/components/DevicePreview.vue';
import type { SnoozeConfig } from '@/core/types';
import type { ScreenSize } from '@/core/screen';
import type { HassLike } from '@/core/hass';
import { Ticker } from '@/runtime/ticker';

/** 面板挂载句柄：热更新配置 / 切换目标尺寸 / 卸载 */
export interface DevicePreviewHandle {
  /** 更新屏保配置（内容热更新） */
  update(config: SnoozeConfig): void;
  /** 切换目标屏幕尺寸（自动重算缩放） */
  setScreen(screen: ScreenSize): void;
  /** 卸载并移除渲染内容 */
  destroy(): void;
}

/**
 * 在指定宿主元素内挂载独立模拟设备面板。
 * @param host   宿主容器（尺寸由调用方 CSS 决定，面板自适应可用区）
 * @param config 屏保配置
 * @param screen 目标设备屏幕尺寸（模拟视口）
 * @param hass   可选的 HA 状态（供自定义文本 / 天气实体求值；缺省为空状态）
 */
export function mountDevicePreview(
  host: HTMLElement,
  config: SnoozeConfig,
  screen: ScreenSize,
  hass?: HassLike,
): DevicePreviewHandle {
  // 响应式状态：now 由 Ticker 驱动，hass 供实体占位符求值
  const state = reactive({
    now: new Date(),
    hass: hass ?? ({ states: {} } as HassLike),
  });
  // 可热更新的入参（config / screen）
  const args = reactive({ config, screen });

  const ticker = new Ticker((now) => {
    state.now = now;
  });

  const app: App = createApp({
    setup() {
      return () =>
        h(DevicePreview, {
          config: args.config,
          deviceId: 'device-preview',
          screen: args.screen,
          editMode: true,
        });
    },
  });
  app.provide('snoozeState', state);
  app.mount(host);

  ticker.watchVisibility();
  ticker.start();

  return {
    update(next: SnoozeConfig): void {
      args.config = next;
    },
    setScreen(next: ScreenSize): void {
      args.screen = next;
    },
    destroy(): void {
      ticker.destroy();
      app.unmount();
    },
  };
}
