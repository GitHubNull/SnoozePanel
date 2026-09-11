/**
 * SnoozePanel 自定义元素（custom panel 元素）。
 *
 * 视图级门控：仅当某个 Lovelace 视图包含 `type: custom:snoozepanel` 卡片时，
 * HA 前端才会实例化本元素。元素从所属视图的 raw YAML 读取 `snoozepanel:` 段配置，
 * 据此激活运行时控制器。无此卡片的视图完全零加载、零副作用。
 *
 * 本元素自身不渲染任何可见内容（display:none）。
 */

import { normalizeConfig } from '@/core/config';
import { resolveDeviceId, isDeviceAllowed } from '@/core/device';
import type { HassLike } from '@/core/hass';
import { SnoozeController } from '@/runtime/controller';

export class SnoozePanelElement extends HTMLElement {
  private controller: SnoozeController | null = null;
  private _hass: HassLike | null = null;
  private cardConfig: Record<string, unknown> | null = null;
  private deviceId = '';

  /** HA 调用 setConfig 传入卡片配置（含视图上下文由 lovelace 注入） */
  setConfig(config: Record<string, unknown>): void {
    this.cardConfig = config;
    this.style.display = 'none';
    this.maybeStart();
  }

  /** HA 每次状态更新时设置 hass */
  set hass(value: HassLike) {
    this._hass = value;
    if (this.controller) {
      this.controller.setHass(value);
    } else {
      this.maybeStart();
    }
  }

  get hass(): HassLike | null {
    return this._hass;
  }

  connectedCallback(): void {
    this.style.display = 'none';
    this.maybeStart();
  }

  disconnectedCallback(): void {
    this.teardown();
  }

  /**
   * 从卡片配置中读取视图级 snoozepanel 配置。
   * HA 在渲染视图卡片时，会把视图的其他自定义字段透传到卡片配置的上下文中；
   * 这里直接从卡片配置读取 `snoozepanel` 段（用户在卡片里引用视图配置）。
   */
  private readViewConfig(): Record<string, unknown> | null {
    if (!this.cardConfig) return null;
    const raw = this.cardConfig.snoozepanel ?? this.cardConfig;
    if (raw && typeof raw === 'object' && Object.keys(raw).length > 0) {
      return raw as Record<string, unknown>;
    }
    return null;
  }

  private maybeStart(): void {
    if (this.controller || !this._hass || !this.cardConfig) return;
    const rawView = this.readViewConfig();
    if (!rawView) return; // 无视图配置 → 零副作用

    const config = normalizeConfig(rawView);
    if (!config.enabled) return;

    this.deviceId = resolveDeviceId();
    if (!isDeviceAllowed(this.deviceId, config.devices)) return; // 设备不在白名单 → 不启用

    this.controller = new SnoozeController(config, this._hass, this.deviceId);
    this.controller.start();
  }

  private teardown(): void {
    if (this.controller) {
      this.controller.destroy();
      this.controller = null;
    }
  }
}

export function registerSnoozePanel(): void {
  if (!customElements.get('snooze-panel')) {
    customElements.define('snooze-panel', SnoozePanelElement);
  }
}
