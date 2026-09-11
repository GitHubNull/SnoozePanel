import { describe, it, expect } from 'vitest';
import {
  evalEntityCondition,
  evalEntity,
  evalTime,
  evalSun,
  evalConditions,
} from '../core/conditions';
import type { HassLike } from '../core/hass';

function makeHass(states: Record<string, { state: string; attributes?: Record<string, unknown> }>): HassLike {
  const out: HassLike['states'] = {};
  for (const [id, s] of Object.entries(states)) {
    out[id] = {
      entity_id: id,
      state: s.state,
      attributes: s.attributes ?? {},
      last_changed: '',
      last_updated: '',
    };
  }
  return { states: out };
}

describe('evalEntityCondition 实体条件', () => {
  const hass = makeHass({
    'binary_sensor.door': { state: 'on' },
    'sensor.lux': { state: '42' },
    'sensor.bad': { state: 'unavailable' },
  });

  it('state 精确匹配', () => {
    expect(evalEntityCondition(hass, { entity: 'binary_sensor.door', state: 'on' })).toBe(true);
    expect(evalEntityCondition(hass, { entity: 'binary_sensor.door', state: 'off' })).toBe(false);
  });

  it('above / below 数值比较', () => {
    expect(evalEntityCondition(hass, { entity: 'sensor.lux', above: 40 })).toBe(true);
    expect(evalEntityCondition(hass, { entity: 'sensor.lux', above: 50 })).toBe(false);
    expect(evalEntityCondition(hass, { entity: 'sensor.lux', below: 50 })).toBe(true);
    expect(evalEntityCondition(hass, { entity: 'sensor.lux', below: 40 })).toBe(false);
  });

  it('非数值状态 above/below 判定为不满足', () => {
    expect(evalEntityCondition(hass, { entity: 'sensor.bad', above: 0 })).toBe(false);
  });

  it('多判定 AND（state + below）', () => {
    expect(evalEntityCondition(hass, { entity: 'sensor.lux', state: '42', below: 50 })).toBe(true);
    expect(evalEntityCondition(hass, { entity: 'sensor.lux', state: '42', below: 40 })).toBe(false);
  });

  it('无判定字段视为不满足', () => {
    expect(evalEntityCondition(hass, { entity: 'sensor.lux' })).toBe(false);
  });

  it('实体不存在判定为不满足', () => {
    expect(evalEntityCondition(hass, { entity: 'sensor.missing', state: 'on' })).toBe(false);
  });
});

describe('evalEntity 实体条件组（AND）', () => {
  const hass = makeHass({
    'binary_sensor.home': { state: 'on' },
    'sensor.lux': { state: '30' },
  });

  it('空数组视为满足', () => {
    expect(evalEntity(hass, [])).toBe(true);
    expect(evalEntity(hass, undefined)).toBe(true);
  });

  it('全部满足才为真', () => {
    expect(evalEntity(hass, [
      { entity: 'binary_sensor.home', state: 'on' },
      { entity: 'sensor.lux', below: 50 },
    ])).toBe(true);
    expect(evalEntity(hass, [
      { entity: 'binary_sensor.home', state: 'on' },
      { entity: 'sensor.lux', below: 10 },
    ])).toBe(false);
  });
});

describe('evalTime 时间段条件', () => {
  it('无配置视为满足', () => {
    expect(evalTime(undefined, new Date(2026, 8, 11, 12, 0))).toBe(true);
  });

  it('同日区间 08:00-18:00', () => {
    const cond = { after: '08:00', before: '18:00' };
    expect(evalTime(cond, new Date(2026, 8, 11, 12, 0))).toBe(true);
    expect(evalTime(cond, new Date(2026, 8, 11, 7, 0))).toBe(false);
    expect(evalTime(cond, new Date(2026, 8, 11, 19, 0))).toBe(false);
  });

  it('跨午夜区间 21:00-07:00', () => {
    const cond = { after: '21:00', before: '07:00' };
    expect(evalTime(cond, new Date(2026, 8, 11, 23, 0))).toBe(true);
    expect(evalTime(cond, new Date(2026, 8, 11, 3, 0))).toBe(true);
    expect(evalTime(cond, new Date(2026, 8, 11, 12, 0))).toBe(false);
  });

  it('仅 after', () => {
    expect(evalTime({ after: '20:00' }, new Date(2026, 8, 11, 21, 0))).toBe(true);
    expect(evalTime({ after: '20:00' }, new Date(2026, 8, 11, 19, 0))).toBe(false);
  });

  it('weekday 限定', () => {
    // 2026-09-11 是周五
    const friday = new Date(2026, 8, 11, 12, 0);
    expect(evalTime({ weekday: ['fri'] }, friday)).toBe(true);
    expect(evalTime({ weekday: ['mon', 'tue'] }, friday)).toBe(false);
  });

  it('weekday + 时间组合', () => {
    const friday = new Date(2026, 8, 11, 22, 0);
    expect(evalTime({ weekday: ['fri'], after: '21:00' }, friday)).toBe(true);
    expect(evalTime({ weekday: ['sat'], after: '21:00' }, friday)).toBe(false);
  });
});

describe('evalSun 日出日落条件', () => {
  const hass = makeHass({
    'sun.sun': {
      state: 'above_horizon',
      attributes: {
        next_rising: '2026-09-12T06:00:00+08:00',
        next_setting: '2026-09-11T18:30:00+08:00',
      },
    },
  });

  it('无配置视为满足', () => {
    expect(evalSun(hass, undefined, new Date(2026, 8, 11, 12, 0))).toBe(true);
  });

  it('日落后偏移', () => {
    // 日落 18:30，偏移 30 分钟 → 19:00 后满足
    expect(evalSun(hass, { after_sunset_offset: 30 }, new Date(2026, 8, 11, 19, 30))).toBe(true);
    expect(evalSun(hass, { after_sunset_offset: 30 }, new Date(2026, 8, 11, 18, 45))).toBe(false);
  });

  it('无 sun 实体不阻塞', () => {
    const noSun = makeHass({});
    expect(evalSun(noSun, { after_sunset_offset: 0 }, new Date())).toBe(true);
  });
});

describe('evalConditions 综合 AND', () => {
  const hass = makeHass({
    'binary_sensor.home': { state: 'on' },
  });

  it('实体 + 时间同时满足才为真', () => {
    const now = new Date(2026, 8, 11, 22, 0);
    expect(evalConditions(hass, {
      entity: [{ entity: 'binary_sensor.home', state: 'on' }],
      time: { after: '21:00' },
    }, now)).toBe(true);

    expect(evalConditions(hass, {
      entity: [{ entity: 'binary_sensor.home', state: 'off' }],
      time: { after: '21:00' },
    }, now)).toBe(false);

    expect(evalConditions(hass, {
      entity: [{ entity: 'binary_sensor.home', state: 'on' }],
      time: { after: '23:00' },
    }, now)).toBe(false);
  });
});
