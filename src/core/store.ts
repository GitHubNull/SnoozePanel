/**
 * 设备级配置读写封装层。
 *
 * 分层策略（架构决策 9）：
 *   - 视图级配置：视图 raw YAML 的 snoozepanel: 段，随 lovelace 存储天然持久化（基础层）。
 *   - 设备级配置：每台平板各自的覆盖项，落盘到 HA 后端 custom component（.storage/），
 *     通过 hass.callWS() 读写（覆盖层，优先）。
 *
 * 红线：localStorage 仅作设备 id 临时标识/缓存，严禁作配置权威存储。
 * 后端不可用时：读 → 降级返回 null（仅用视图 YAML）；写 → console.warn 并返回 false。
 */

import type { HassLike } from './hass';
import type { SnoozeConfig } from './types';

/** WS 命令类型（与后端 const.py 对应） */
const WS_GET = 'snoozepanel/get_config';
const WS_SET = 'snoozepanel/set_config';

/** 后端是否可用（hass.callWS 存在即认为可尝试） */
function backendAvailable(hass: HassLike): boolean {
  return typeof hass.callWS === 'function';
}

/**
 * 读取某设备的配置覆盖。
 * 优先走后端 WS；后端不可用或异常时返回 null（调用方回退到视图 YAML）。
 */
export async function loadDeviceConfig(
  hass: HassLike,
  deviceId: string,
): Promise<Partial<SnoozeConfig> | null> {
  if (!backendAvailable(hass)) {
    console.warn('[snoozepanel] 后端不可用（无 callWS），设备级配置仅使用视图 YAML');
    return null;
  }
  try {
    const res = await hass.callWS!<{ config: Partial<SnoozeConfig> | null }>({
      type: WS_GET,
      device_id: deviceId,
    });
    return res?.config ?? null;
  } catch (err) {
    console.warn('[snoozepanel] 读取设备配置失败，回退视图 YAML：', err);
    return null;
  }
}

/**
 * 写入某设备的配置覆盖。
 * 优先走后端 WS；后端不可用或异常时 console.warn 并返回 false（不写 localStorage）。
 */
export async function saveDeviceConfig(
  hass: HassLike,
  deviceId: string,
  config: Partial<SnoozeConfig>,
): Promise<boolean> {
  if (!backendAvailable(hass)) {
    console.warn('[snoozepanel] 后端不可用（无 callWS），设备级配置未保存');
    return false;
  }
  try {
    await hass.callWS!({ type: WS_SET, device_id: deviceId, config });
    return true;
  } catch (err) {
    console.warn('[snoozepanel] 保存设备配置失败：', err);
    return false;
  }
}

/**
 * 合并配置：视图 YAML 为基础，设备级覆盖叠加（覆盖层字段优先）。
 * 浅合并 components 子对象，保证设备可单独覆盖某组件（如只改表盘）。
 */
export function mergeConfig(
  base: SnoozeConfig,
  override: Partial<SnoozeConfig> | null,
): SnoozeConfig {
  if (!override) return base;
  const merged: SnoozeConfig = { ...base, ...override };
  if (base.components || override.components) {
    merged.components = {
      ...base.components,
      ...(override.components ?? {}),
      clock: { ...base.components.clock, ...(override.components?.clock ?? {}) },
      calendar: { ...base.components.calendar, ...(override.components?.calendar ?? {}) },
      lunar: { ...base.components.lunar, ...(override.components?.lunar ?? {}) },
      weather: { ...base.components.weather, ...(override.components?.weather ?? {}) },
      texts: override.components?.texts ?? base.components.texts,
    };
  }
  if (base.background || override.background) {
    merged.background = { ...base.background, ...(override.background ?? {}) };
  }
  return merged;
}
