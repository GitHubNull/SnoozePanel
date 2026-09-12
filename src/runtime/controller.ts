/**
 * 屏保激活控制器（每个启用 SnoozePanel 的视图一个实例）。
 *
 * 职责：
 *  - 监听用户输入（触摸/按键/指针）与路由切换，重置闲置计时
 *  - 闲置超时且条件满足 → 激活屏保
 *  - 条件失效且屏保中 → 立即退出
 *  - 退出冷却防误触
 *  - screensaver_entity（input_boolean）双向同步
 *  - 彻底的事件/定时器清理
 */

import type { SnoozeConfig } from '@/core/types';
import { evalConditions } from '@/core/conditions';
import type { HassLike } from '@/core/hass';
import { mountScreensaver, type ScreensaverHandle } from './mount';
import { Ticker } from './ticker';

const INPUT_EVENTS = ['pointerdown', 'touchstart', 'keydown'] as const;

export class SnoozeController {
  private config: SnoozeConfig;
  private hass: HassLike;
  private readonly deviceId: string;

  private active = false;
  private handle: ScreensaverHandle | null = null;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  /** 闲置门槛是否已达成（真正闲置计时器触发后置位，任意输入即复位） */
  private idleElapsed = false;
  private condTimer: ReturnType<typeof setInterval> | null = null;
  private cooldownUntil = 0;
  private ticker: Ticker | null = null;
  private destroyed = false;

  private readonly onInput = (): void => {
    if (this.active) {
      // 冷却期内忽略退出输入，防误触
      if (Date.now() >= this.cooldownUntil) {
        this.exit();
      }
      return;
    }
    this.resetIdle();
  };

  private readonly onRouteChange = (): void => {
    if (this.active) this.exit();
    this.resetIdle();
  };

  constructor(config: SnoozeConfig, hass: HassLike, deviceId: string) {
    this.config = config;
    this.hass = hass;
    this.deviceId = deviceId;
  }

  /** 更新 hass（实体状态变化时由 panel 元素调用） */
  setHass(hass: HassLike): void {
    this.hass = hass;
    if (this.handle) this.handle.update(new Date(), hass);
    // 实体变化即时重估条件：条件失效且屏保中 → 退出
    if (this.active && !this.conditionsMet()) {
      this.exit();
    }
    // screensaver_entity 外部强制同步
    this.syncFromEntity();
  }

  /** 更新配置（视图 YAML 热更新） */
  setConfig(config: SnoozeConfig): void {
    this.config = config;
  }

  start(): void {
    if (this.destroyed) return;
    for (const ev of INPUT_EVENTS) {
      window.addEventListener(ev, this.onInput, { capture: true, passive: true });
    }
    window.addEventListener('location-changed', this.onRouteChange);
    this.resetIdle();
    // 条件周期重估（时间段/日出日落随时间推移而变化）
    this.condTimer = setInterval(() => this.tickConditions(), 5000);
    // 启动时若 screensaver_entity 已为 on，立即进入
    this.syncFromEntity();
  }

  private conditionsMet(): boolean {
    return evalConditions(this.hass, this.config.conditions, new Date());
  }

  private resetIdle(): void {
    // 任意输入/退出/路由切换后重新开始闲置计时，同时撤销闲置已达成标记
    this.idleElapsed = false;
    if (this.idleTimer !== null) clearTimeout(this.idleTimer);
    if (!this.config.enabled) return;
    this.idleTimer = setTimeout(() => {
      // 闲置计时器真正触发：标记门槛已达成，供条件周期重估兜底
      this.idleElapsed = true;
      this.tryActivate();
    }, this.config.idle_seconds * 1000);
  }

  private tryActivate(): void {
    if (this.active || this.destroyed || !this.config.enabled) return;
    if (!this.conditionsMet()) {
      // 条件不满足，稍后再试（由 condTimer 兜底）
      return;
    }
    this.activate();
  }

  private activate(): void {
    if (this.active || this.destroyed) return;
    this.active = true;
    // 进入后同样应用冷却：短暂忽略触摸/指针输入，防误触立即退出（与面板文案一致）
    this.cooldownUntil = Date.now() + this.config.exit_cooldown_seconds * 1000;
    this.handle = mountScreensaver(this.config, this.hass, this.deviceId);
    // 屏保内时钟 tick
    this.ticker = new Ticker((now) => {
      if (this.handle) this.handle.update(now, this.hass);
    });
    this.ticker.start();
    this.ticker.watchVisibility();
    this.setScreensaverEntity(true);
  }

  private exit(): void {
    if (!this.active) return;
    this.active = false;
    this.cooldownUntil = Date.now() + this.config.exit_cooldown_seconds * 1000;
    if (this.ticker) {
      this.ticker.destroy();
      this.ticker = null;
    }
    if (this.handle) {
      this.handle.destroy();
      this.handle = null;
    }
    this.setScreensaverEntity(false);
    this.resetIdle();
  }

  private tickConditions(): void {
    if (this.destroyed) return;
    if (this.active) {
      if (!this.conditionsMet()) this.exit();
    } else if (this.idleElapsed) {
      // 仅当闲置门槛已达成时才兜底：闲置期间条件曾不满足，条件转好后立即激活。
      // 缺少此判断会导致退出屏保后被本定时器无条件重新激活（绕过闲置门槛）。
      this.tryActivate();
    }
  }

  /** screensaver_entity 双向同步 */
  private setScreensaverEntity(on: boolean): void {
    const entity = this.config.screensaver_entity;
    if (!entity || !this.hass.callService) return;
    const current = this.hass.states[entity]?.state;
    const want = on ? 'on' : 'off';
    if (current === want) return;
    // 触摸退出时同步复位实体
    this.hass.callService('input_boolean', on ? 'turn_on' : 'turn_off', { entity_id: entity })
      .catch(() => { /* 服务调用失败不阻塞主流程 */ });
  }

  /** 外部把 input_boolean 置 on → 强制进入；置 off → 强制退出 */
  private syncFromEntity(): void {
    const entity = this.config.screensaver_entity;
    if (!entity) return;
    const state = this.hass.states[entity]?.state;
    if (state === 'on' && !this.active && this.config.enabled) {
      this.activate();
    } else if (state === 'off' && this.active) {
      this.exit();
    }
  }

  /** 视图卸载时彻底清理 */
  destroy(): void {
    this.destroyed = true;
    if (this.idleTimer !== null) clearTimeout(this.idleTimer);
    if (this.condTimer !== null) clearInterval(this.condTimer);
    for (const ev of INPUT_EVENTS) {
      window.removeEventListener(ev, this.onInput, { capture: true } as EventListenerOptions);
    }
    window.removeEventListener('location-changed', this.onRouteChange);
    if (this.active) this.exit();
  }
}
