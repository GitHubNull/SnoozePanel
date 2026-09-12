/**
 * SnoozePanel 侧边栏入口元素（HA panel_custom 协议）。
 *
 * HA 约定：panel_custom 加载的 module_url 需注册一个自定义元素，
 * 元素名与 webcomponent_name 一致（snooze-panel-sidebar）。
 * 元素接收 hass 属性，渲染全页配置界面。
 */

import { createApp, reactive, type App } from 'vue';
import PrimeVue from 'primevue/config';
import ToastService from 'primevue/toastservice';
import Aura from '@primevue/themes/aura';
import SidebarApp from './SidebarApp.vue';
import type { HassLike } from '@/core/hass';
import { loadInstalledPlugins } from '@/runtime/pluginLoader';

export class SnoozePanelSidebarElement extends HTMLElement {
  private app: App | null = null;
  private state: { hass: HassLike | null } | null = null;

  set hass(value: HassLike) {
    if (this.state) {
      this.state.hass = value;
    } else {
      this.mountApp(value);
    }
  }

  private mountApp(hass: HassLike): void {
    if (this.app) return;
    const state = reactive({ hass });
    this.state = state;

    // 启动时加载后端登记的第三方插件（预编译包，同源 /local 或 blob）
    void loadInstalledPlugins(hass);

    this.app = createApp(SidebarApp, { hass: state.hass });
    this.app.use(PrimeVue, {
      theme: { preset: Aura, options: { darkModeSelector: '.snooze-editor-dark' } },
    });
    this.app.use(ToastService);
    this.app.mount(this);
  }

  disconnectedCallback(): void {
    if (this.app) {
      this.app.unmount();
      this.app = null;
      this.state = null;
    }
  }
}

export function registerSnoozePanelSidebar(): void {
  if (!customElements.get('snooze-panel-sidebar')) {
    customElements.define('snooze-panel-sidebar', SnoozePanelSidebarElement);
  }
}
