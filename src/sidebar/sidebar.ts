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
import { createStyledShadowHost, type StyledShadowHost } from '@/core/styleMirror';
import { loadInstalledPlugins } from '@/runtime/pluginLoader';

export class SnoozePanelSidebarElement extends HTMLElement {
  private app: App | null = null;
  private state: { hass: HassLike | null } | null = null;
  private shadowHost: StyledShadowHost | null = null;

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

    // HA 把 panel_custom 元素托管在 shadow 树内，head 样式跨不过边界：
    // 创建自有 shadow root + 样式镜像，Vue 应用挂载到镜像宿主（见 core/styleMirror.ts）
    this.shadowHost = createStyledShadowHost(this);

    this.app = createApp(SidebarApp, { hass: state.hass });
    this.app.use(PrimeVue, {
      theme: { preset: Aura, options: { darkModeSelector: '.snooze-editor-dark' } },
    });
    this.app.use(ToastService);
    this.app.mount(this.shadowHost.host);
  }

  disconnectedCallback(): void {
    if (this.app) {
      this.app.unmount();
      this.app = null;
      this.state = null;
    }
    if (this.shadowHost) {
      this.shadowHost.destroy();
      this.shadowHost = null;
    }
  }
}

export function registerSnoozePanelSidebar(): void {
  if (!customElements.get('snooze-panel-sidebar')) {
    customElements.define('snooze-panel-sidebar', SnoozePanelSidebarElement);
  }
}
