/**
 * 生效条件引擎：实体 / 时间段 / 日出日落，多组条件为 AND 关系。
 *
 * 所有求值函数为纯函数，返回 true 表示该组条件满足（或未配置视为满足）。
 */

import type { Conditions, EntityCondition, TimeCondition, SunCondition, Weekday } from './types';
import { getState, getNumericState, type HassLike } from './hass';

const WEEKDAY_MAP: Weekday[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

/** 解析 "HH:mm" 为当日分钟数 */
function parseTime(t: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** 单个实体条件是否满足 */
export function evalEntityCondition(hass: HassLike, cond: EntityCondition): boolean {
  const results: boolean[] = [];

  if (cond.state !== undefined) {
    results.push(getState(hass, cond.entity) === cond.state);
  }
  if (cond.above !== undefined) {
    const n = getNumericState(hass, cond.entity);
    results.push(n !== undefined && n > cond.above);
  }
  if (cond.below !== undefined) {
    const n = getNumericState(hass, cond.entity);
    results.push(n !== undefined && n < cond.below);
  }

  // 未指定任何判定 → 视为不满足（配置无效）
  if (results.length === 0) return false;
  // 多个判定 AND
  return results.every(Boolean);
}

/** 实体条件组（数组内 AND） */
export function evalEntity(hass: HassLike, list: EntityCondition[] | undefined): boolean {
  if (!list || list.length === 0) return true;
  return list.every((c) => evalEntityCondition(hass, c));
}

/** 时间段条件 */
export function evalTime(cond: TimeCondition | undefined, now: Date = new Date()): boolean {
  if (!cond) return true;

  // 星期限定
  if (cond.weekday && cond.weekday.length > 0) {
    const today = WEEKDAY_MAP[now.getDay()];
    if (!cond.weekday.includes(today)) return false;
  }

  const after = cond.after !== undefined ? parseTime(cond.after) : null;
  const before = cond.before !== undefined ? parseTime(cond.before) : null;
  const nowMin = now.getHours() * 60 + now.getMinutes();

  if (after !== null && before !== null) {
    if (after <= before) {
      // 同日区间 如 08:00 - 18:00
      if (nowMin < after || nowMin >= before) return false;
    } else {
      // 跨午夜区间 如 21:00 - 07:00
      if (nowMin < after && nowMin >= before) return false;
    }
  } else if (after !== null) {
    if (nowMin < after) return false;
  } else if (before !== null) {
    if (nowMin >= before) return false;
  }

  return true;
}

/** 解析 ISO 时间为分钟数（当日） */
function minutesOfDay(iso: string): number | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.getHours() * 60 + d.getMinutes();
}

/** 日出日落条件（依赖 sun.sun 实体的 next_rising / next_setting 属性） */
export function evalSun(hass: HassLike, cond: SunCondition | undefined, now: Date = new Date()): boolean {
  if (!cond) return true;
  const sun = hass.states['sun.sun'];
  if (!sun) return true; // 无 sun 实体时不阻塞

  const nowMin = now.getHours() * 60 + now.getMinutes();

  if (cond.after_sunset_offset !== undefined) {
    const setting = minutesOfDay(String(sun.attributes.next_setting ?? ''));
    if (setting !== null) {
      const threshold = setting + cond.after_sunset_offset;
      // 简化：仅当当前时间过了（日落+偏移）才满足；跨午夜由时间段条件另行约束
      if (nowMin < threshold) return false;
    }
  }

  if (cond.before_sunrise_offset !== undefined) {
    const rising = minutesOfDay(String(sun.attributes.next_rising ?? ''));
    if (rising !== null) {
      const threshold = rising + cond.before_sunrise_offset;
      if (nowMin >= threshold) return false;
    }
  }

  return true;
}

/**
 * 综合求值：所有已配置条件组 AND。
 */
export function evalConditions(hass: HassLike, conds: Conditions, now: Date = new Date()): boolean {
  return (
    evalEntity(hass, conds.entity) &&
    evalTime(conds.time, now) &&
    evalSun(hass, conds.sun, now)
  );
}
