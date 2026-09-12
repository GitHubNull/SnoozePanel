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
import { loadDeviceConfig, mergeConfig } from '@/core/store';
import type { SnoozeConfig } from '@/core/types';
import { SnoozeController } from '@/runtime/controller';

export class SnoozePanelElement extends HTMLElement {
  private controller: SnoozeController | null = null;
  private _hass: HassLike | null = null;
  private cardConfig: Record<string, unknown> | null = null;
  private deviceId = '';
  /** 已加载的设备级配置覆盖（热更新时复用，避免重复请求后端） */
  private deviceOverride: Partial<SnoozeConfig> | null = null;

  /** HA 调用 setConfig 传入卡片配置（含视图上下文由 lovelace 注入） */
  setConfig(config: Record<string, unknown>): void {
    this.cardConfig = config;
    this.style.display = 'none';
    // 控制器已启动：视图 YAML / card editor 回填的新配置必须热同步给运行中的控制器，
    // 否则屏保会一直沿用首次配置（表现为「编辑后触发屏保仍是默认布局」）。
    if (this.controller) {
      this.applyConfigUpdate();
      return;
    }
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

    const viewConfig = normalizeConfig(rawView);
    if (!viewConfig.enabled) return;

    this.deviceId = resolveDeviceId();
    if (!isDeviceAllowed(this.deviceId, viewConfig.devices)) return; // 设备不在白名单 → 不启用

    // 异步加载设备级覆盖（后端 .storage/）并合并，再启动控制器；
    // 后端不可用时 loadDeviceConfig 返回 null，仅用视图 YAML。
    void this.startWithMergedConfig(viewConfig);
  }

  /**
   * 运行中收到新配置的热更新：重解析视图配置 + 合并设备级覆盖后交给控制器；
   * 若新配置已禁用或当前设备被排除，则直接拆卸（与首次启动的门控一致）。
   */
  private applyConfigUpdate(): void {
    const rawView = this.readViewConfig();
    if (!rawView) {
      this.teardown();
      return;
    }
    const viewConfig = normalizeConfig(rawView);
    if (!viewConfig.enabled) {
      this.teardown();
      return;
    }
    if (!this.deviceId) this.deviceId = resolveDeviceId();
    if (!isDeviceAllowed(this.deviceId, viewConfig.devices)) {
      this.teardown();
      return;
    }
    this.controller?.setConfig(mergeConfig(viewConfig, this.deviceOverride));
  }

  /** 加载设备级覆盖并合并配置后启动控制器 */
  private async startWithMergedConfig(viewConfig: ReturnType<typeof normalizeConfig>): Promise<void> {
    if (this.controller || !this._hass) return; // 等待期间可能已被拆卸/启动
    const override = await loadDeviceConfig(this._hass, this.deviceId);
    if (this.controller || !this._hass) return;
    this.deviceOverride = override;
    const config = mergeConfig(viewConfig, override);
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
