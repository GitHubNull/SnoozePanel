/**
 * SnoozePanel 可视化配置编辑器（HA Lovelace card GUI editor 协议）。
 *
 * HA 约定：自定义卡片提供编辑器需注册 `<type>-editor` 自定义元素，
 * 元素实现 setConfig(config)，并在配置变更时派发 `config-changed` 事件
 * （detail: { config }）。本编辑器基于 PrimeVue 构建中文图形界面。
 */

import { createApp, reactive, type App } from 'vue';
import PrimeVue from 'primevue/config';
import ToastService from 'primevue/toastservice';
import Aura from '@primevue/themes/aura';
import EditorApp from './EditorApp.vue';
import { normalizeConfig } from '@/core/config';
import { createStyledShadowHost, type StyledShadowHost } from '@/core/styleMirror';
import type { SnoozeConfig } from '@/core/types';
import type { HassLike } from '@/core/hass';

export class SnoozePanelEditorElement extends HTMLElement {
  private app: App | null = null;
  private state: { config: SnoozeConfig; hass: HassLike | null } | null = null;
  private shadowHost: StyledShadowHost | null = null;
  private _hass: HassLike | null = null;

  set hass(value: HassLike) {
    this._hass = value;
    if (this.state) this.state.hass = value;
  }

  setConfig(config: Record<string, unknown>): void {
    // 卡片配置中的 snoozepanel 段即视图配置
    const raw = (config.snoozepanel ?? config) as Record<string, unknown>;
    const normalized = normalizeConfig(raw);
    if (this.state) {
      this.state.config = normalized;
    } else {
      this.mountEditor(normalized);
    }
  }

  private mountEditor(config: SnoozeConfig): void {
    if (this.app) return;
    const state = reactive({
      config,
      hass: this._hass,
    });
    this.state = state;

    // HA 卡片编辑弹窗把本元素托管在 shadow 树内，head 样式跨不过边界：
    // 创建自有 shadow root + 样式镜像（见 core/styleMirror.ts）
    this.shadowHost = createStyledShadowHost(this);

    this.app = createApp(EditorApp, {
      config: state.config,
      hass: state.hass,
      onChange: (next: SnoozeConfig) => {
        state.config = next;
        this.dispatchEvent(new CustomEvent('config-changed', {
          detail: { config: { type: 'custom:snooze-panel', snoozepanel: next } },
          bubbles: true,
          composed: true,
        }));
      },
    });
    this.app.provide('editorState', state);
    this.app.use(PrimeVue, {
      theme: { preset: Aura, options: { darkModeSelector: '.snooze-editor-dark' } },
    });
    // Toast 服务：设备级保存等操作的成功/失败反馈（见 EditorApp.vue）
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

export function registerSnoozePanelEditor(): void {
  if (!customElements.get('snooze-panel-editor')) {
    customElements.define('snooze-panel-editor', SnoozePanelEditorElement);
  }
}
