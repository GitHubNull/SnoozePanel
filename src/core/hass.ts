/**
 * Home Assistant hass 对象的最小结构类型（仅声明 SnoozePanel 用到的字段）。
 * 避免直接依赖 HA 前端内部类型，保持插件自包含。
 */

export interface HassEntityState {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown>;
  last_changed: string;
  last_updated: string;
}

export interface HassLike {
  states: Record<string, HassEntityState>;
  user?: { name?: string; is_admin?: boolean };
  callService?: (domain: string, service: string, data?: Record<string, unknown>) => Promise<unknown>;
}

/** 读取实体状态字符串，不存在返回 undefined */
export function getState(hass: HassLike, entityId: string): string | undefined {
  return hass.states[entityId]?.state;
}

/** 读取实体数值状态，无法解析返回 undefined */
export function getNumericState(hass: HassLike, entityId: string): number | undefined {
  const s = getState(hass, entityId);
  if (s === undefined) return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}
