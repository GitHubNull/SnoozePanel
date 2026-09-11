/**
 * 自定义文本的实体占位符替换。
 *
 * 占位符语法：{entity_id} 或 {entity_id:unit}（unit 为可选后缀单位）。
 * 实体不存在时占位符替换为 "--"，不抛异常。
 */

import { getState, type HassLike } from './hass';

const PLACEHOLDER = /\{([a-z_]+\.[a-z0-9_]+)(?::([^{}]*))?\}/g;

/**
 * 替换文本中的实体占位符为当前状态值。
 * 例："室温 {sensor.temp}°C" → "室温 23.5°C"
 */
export function renderText(template: string, hass: HassLike): string {
  return template.replace(PLACEHOLDER, (_match, entityId: string, suffix: string | undefined) => {
    const state = getState(hass, entityId);
    const value = state === undefined ? '--' : state;
    return suffix !== undefined && suffix !== '' ? `${value}${suffix}` : value;
  });
}
