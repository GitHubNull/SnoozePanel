import { describe, it, expect } from 'vitest';
import { normalizeConfig } from '../core/config';
import { DEFAULT_CONFIG } from '../core/types';

describe('normalizeConfig 配置规范化', () => {
  it('非对象输入返回默认配置', () => {
    expect(normalizeConfig(null)).toEqual(DEFAULT_CONFIG);
    expect(normalizeConfig(undefined)).toEqual(DEFAULT_CONFIG);
    expect(normalizeConfig('string')).toEqual(DEFAULT_CONFIG);
    expect(normalizeConfig(42)).toEqual(DEFAULT_CONFIG);
  });

  it('空对象套用全部默认值', () => {
    const c = normalizeConfig({});
    expect(c.enabled).toBe(true);
    expect(c.idle_seconds).toBe(60);
    expect(c.exit_cooldown_seconds).toBe(2);
    expect(c.theme).toBe('midnight');
    expect(c.components.clock.style).toBe('digital');
  });

  it('合法字段覆盖默认值', () => {
    const c = normalizeConfig({
      idle_seconds: 120,
      theme: 'paper',
      components: { clock: { style: 'analog', hour24: false, seconds: true } },
    });
    expect(c.idle_seconds).toBe(120);
    expect(c.theme).toBe('paper');
    expect(c.components.clock.style).toBe('analog');
    expect(c.components.clock.hour24).toBe(false);
    expect(c.components.clock.seconds).toBe(true);
  });

  it('idle_seconds 下限保护', () => {
    expect(normalizeConfig({ idle_seconds: 1 }).idle_seconds).toBe(5);
  });

  it('非法 theme 回退 midnight', () => {
    expect(normalizeConfig({ theme: 'neon' }).theme).toBe('midnight');
  });

  it('非法 position 回退默认', () => {
    const c = normalizeConfig({ components: { clock: { position: 'nowhere' } } });
    expect(c.components.clock.position).toBe(DEFAULT_CONFIG.components.clock.position);
  });

  it('绝对坐标 position 保留并夹取范围', () => {
    const c = normalizeConfig({ components: { clock: { position: { x: 50, y: 150 } } } });
    expect(c.components.clock.position).toEqual({ x: 50, y: 100 });
  });

  it('devices 白/黑名单规范化', () => {
    const c = normalizeConfig({ devices: { mode: 'whitelist', list: ['dev-a', 123, 'dev-b'] } });
    expect(c.devices).toEqual({ mode: 'whitelist', list: ['dev-a', 'dev-b'] });
  });

  it('devices 缺 mode 视为 null', () => {
    expect(normalizeConfig({ devices: { list: ['dev-a'] } }).devices).toBeNull();
  });

  it('实体条件过滤非法项', () => {
    const c = normalizeConfig({
      conditions: {
        entity: [
          { entity: 'a.b', state: 'on' },
          { noEntity: true },
          { entity: 'c.d', above: 5 },
        ],
      },
    });
    expect(c.conditions.entity).toHaveLength(2);
    expect(c.conditions.entity![0]).toEqual({ entity: 'a.b', state: 'on' });
  });

  it('weekday 过滤非法星期值', () => {
    const c = normalizeConfig({ conditions: { time: { weekday: ['mon', 'funday', 'fri'] } } });
    expect(c.conditions.time!.weekday).toEqual(['mon', 'fri']);
  });

  it('background dim 夹取 0-1', () => {
    expect(normalizeConfig({ background: { dim: 5 } }).background.dim).toBe(1);
    expect(normalizeConfig({ background: { dim: -1 } }).background.dim).toBe(0);
  });

  it('texts 过滤无 content 项', () => {
    const c = normalizeConfig({
      components: { texts: [{ content: '你好' }, { position: 'center' }, { content: '{a.b}' }] },
    });
    expect(c.components.texts).toHaveLength(2);
  });

  it('component_templates 仅保留字符串值', () => {
    const c = normalizeConfig({ component_templates: { clock: 'true', bad: 123 } });
    expect(c.component_templates).toEqual({ clock: 'true' });
  });

  it('clock.style 透传任意表盘 id', () => {
    // 表盘框架后 style 为表盘 id（string），core 层宽松透传，渲染层 getFace 兜底
    expect(normalizeConfig({ components: { clock: { style: 'chrono' } } }).components.clock.style).toBe('chrono');
    expect(normalizeConfig({ components: { clock: { style: 'minimal' } } }).components.clock.style).toBe('minimal');
    expect(normalizeConfig({ components: { clock: { style: 'ring' } } }).components.clock.style).toBe('ring');
    expect(normalizeConfig({ components: { clock: { style: 'orbit' } } }).components.clock.style).toBe('orbit');
  });

  it('clock.style 非法/空值回退默认 digital', () => {
    expect(normalizeConfig({ components: { clock: { style: '' } } }).components.clock.style).toBe('digital');
    expect(normalizeConfig({ components: { clock: { style: '   ' } } }).components.clock.style).toBe('digital');
    expect(normalizeConfig({ components: { clock: { style: 123 } } }).components.clock.style).toBe('digital');
    expect(normalizeConfig({ components: { clock: {} } }).components.clock.style).toBe('digital');
  });

  it('clock.style 去除首尾空白', () => {
    expect(normalizeConfig({ components: { clock: { style: '  chrono  ' } } }).components.clock.style).toBe('chrono');
  });
});
