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

    // panel_custom 不给自定义元素高度（ha-panel-custom 仅 display:block + 安全区 padding，
    // 元素默认 display:inline 无高度链）：宿主自行占满内容区。panel_custom 页面无顶栏，
    // 可用高度即视口高减去安全区；dvh 不支持的旧浏览器回退 vh（非法赋值被忽略）。
    this.style.display = 'block';
    this.style.height = 'calc(100vh - var(--safe-area-inset-top, 0px) - var(--safe-area-inset-bottom, 0px))';
    this.style.height = 'calc(100dvh - var(--safe-area-inset-top, 0px) - var(--safe-area-inset-bottom, 0px))';

    // 启动时加载后端登记的第三方插件（预编译包，同源 /local 或 blob）
    void loadInstalledPlugins(hass);

    // HA 把 panel_custom 元素托管在 shadow 树内，head 样式跨不过边界：
    // 创建自有 shadow root + 样式镜像，Vue 应用挂载到镜像宿主（见 core/styleMirror.ts）
    this.shadowHost = createStyledShadowHost(this);
    // 打通「宿主 → shadow 挂载点 → Vue 根」高度链，内部 flex 布局才能撑满
    this.shadowHost.host.style.height = '100%';

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
