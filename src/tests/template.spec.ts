import { describe, it, expect } from 'vitest';
import { evalTemplate } from '../core/template';
import { renderText } from '../core/text';
import type { HassLike } from '../core/hass';

function makeHass(): HassLike {
  return {
    states: {
      'sensor.temp': { entity_id: 'sensor.temp', state: '23.5', attributes: {}, last_changed: '', last_updated: '' },
      'binary_sensor.dark': { entity_id: 'binary_sensor.dark', state: 'on', attributes: {}, last_changed: '', last_updated: '' },
    },
    user: { name: 'admin', is_admin: true },
  };
}

describe('evalTemplate 显隐表达式', () => {
  const hass = makeHass();

  it('空表达式返回默认值', () => {
    expect(evalTemplate(null, hass)).toBe(true);
    expect(evalTemplate('', hass)).toBe(true);
    expect(evalTemplate('   ', hass, false)).toBe(false);
  });

  it('正常布尔表达式', () => {
    expect(evalTemplate("states['binary_sensor.dark'].state === 'on'", hass)).toBe(true);
    expect(evalTemplate("states['binary_sensor.dark'].state === 'off'", hass)).toBe(false);
  });

  it('可访问 hass 与 user 上下文', () => {
    expect(evalTemplate('user.is_admin === true', hass)).toBe(true);
    expect(evalTemplate("Number(states['sensor.temp'].state) > 20", hass)).toBe(true);
  });

  it('语法错误优雅降级为默认值', () => {
    expect(evalTemplate('this is not valid js(((', hass)).toBe(true);
    expect(evalTemplate('this is not valid js(((', hass, false)).toBe(false);
  });

  it('运行时异常优雅降级', () => {
    expect(evalTemplate("states['missing.entity'].state.toUpperCase()", hass)).toBe(true);
  });

  it('非布尔结果转布尔', () => {
    expect(evalTemplate("states['sensor.temp'].state", hass)).toBe(true); // '23.5' truthy
    expect(evalTemplate("''", hass)).toBe(false);
  });
});

describe('renderText 实体占位符', () => {
  const hass = makeHass();

  it('替换实体状态', () => {
    expect(renderText('室温 {sensor.temp}°C', hass)).toBe('室温 23.5°C');
  });

  it('带单位后缀占位符', () => {
    expect(renderText('温度 {sensor.temp:°C}', hass)).toBe('温度 23.5°C');
  });

  it('实体不存在替换为 --', () => {
    expect(renderText('湿度 {sensor.humidity}%', hass)).toBe('湿度 --%');
  });

  it('多个占位符', () => {
    expect(renderText('{sensor.temp} / {binary_sensor.dark}', hass)).toBe('23.5 / on');
  });

  it('无占位符原样返回', () => {
    expect(renderText('纯文本', hass)).toBe('纯文本');
  });
});
