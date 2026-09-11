/**
 * 屏保 Vue 子应用的挂载与卸载。
 *
 * 激活时向 document.body append 一个全屏容器并挂载 Vue 应用；
 * 退出时 unmount + 移除容器，确保 DOM 无残留、无内存泄漏。
 */

import { createApp, reactive, type App } from 'vue';
import ScreensaverApp from '@/ui/ScreensaverApp.vue';
import type { SnoozeConfig } from '@/core/types';
import type { HassLike } from '@/core/hass';

export interface ScreensaverHandle {
  /** 更新响应式数据（now / hass） */
  update(now: Date, hass: HassLike): void;
  /** 彻底卸载并移除 DOM */
  destroy(): void;
  /** 根容器元素 */
  readonly el: HTMLElement;
}

export function mountScreensaver(
  config: SnoozeConfig,
  hass: HassLike,
  deviceId: string,
): ScreensaverHandle {
  const container = document.createElement('div');
  container.id = 'snoozepanel-root';
  document.body.appendChild(container);

  // reactive 驱动 now / hass 更新，屏保组件据此刷新
  const state = reactive({
    now: new Date(),
    hass,
  });

  const app: App = createApp(ScreensaverApp, {
    config,
    hass: state.hass,
    now: state.now,
    deviceId,
  });

  // 通过 provide 传递响应式 state，屏保内组件 inject 使用
  app.provide('snoozeState', state);
  app.mount(container);

  return {
    el: container,
    update(now: Date, h: HassLike): void {
      state.now = now;
      state.hass = h;
    },
    destroy(): void {
      app.unmount();
      if (container.parentNode) {
        container.parentNode.removeChild(container);
      }
    },
  };
}
