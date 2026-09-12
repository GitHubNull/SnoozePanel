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

  it('旧版 position 字段被忽略，回退默认 layout', () => {
    const c = normalizeConfig({ components: { clock: { position: 'nowhere' } } });
    expect(c.components.clock.layout).toEqual(DEFAULT_CONFIG.components.clock.layout);
  });

  it('layout 各字段夹取 0-100', () => {
    const c = normalizeConfig({ components: { clock: { layout: { x: -10, y: 150, w: 200, h: 120 } } } });
    expect(c.components.clock.layout).toEqual({ x: 0, y: 100, w: 100, h: 100 });
  });

  it('layout 缺省字段回退默认值', () => {
    const c = normalizeConfig({ components: { clock: { layout: { x: 30 } } } });
    expect(c.components.clock.layout.x).toBe(30);
    expect(c.components.clock.layout.y).toBe(DEFAULT_CONFIG.components.clock.layout.y);
    expect(c.components.clock.layout.w).toBe(DEFAULT_CONFIG.components.clock.layout.w);
  });

  it('layout 非对象回退默认', () => {
    const c = normalizeConfig({ components: { clock: { layout: 'center' } } });
    expect(c.components.clock.layout).toEqual(DEFAULT_CONFIG.components.clock.layout);
  });

  it('layout h 为可选字段，缺省不输出 h', () => {
    const c = normalizeConfig({ components: { clock: { layout: { x: 50, y: 50, w: 60 } } } });
    expect(c.components.clock.layout.h).toBeUndefined();
  });

  it('合法 color 透传（hex/rgb/颜色名）', () => {
    expect(normalizeConfig({ components: { clock: { color: '#ff0000' } } }).components.clock.color).toBe('#ff0000');
    expect(normalizeConfig({ components: { clock: { color: '#f00' } } }).components.clock.color).toBe('#f00');
    expect(normalizeConfig({ components: { clock: { color: 'rgb(255,0,0)' } } }).components.clock.color).toBe('rgb(255,0,0)');
    expect(normalizeConfig({ components: { clock: { color: 'rgba(255,0,0,0.5)' } } }).components.clock.color).toBe('rgba(255,0,0,0.5)');
    expect(normalizeConfig({ components: { clock: { color: 'red' } } }).components.clock.color).toBe('red');
  });

  it('裸 hex 自动补 #（PrimeVue ColorPicker 输出无 #）', () => {
    // ColorPicker format="hex" 输出形如 175cd4 的裸 hex，配置层需补齐 '#' 才合法
    expect(normalizeConfig({ components: { clock: { color: '175cd4' } } }).components.clock.color).toBe('#175cd4');
    expect(normalizeConfig({ components: { clock: { color: 'fff' } } }).components.clock.color).toBe('#fff');
    expect(normalizeConfig({ components: { clock: { color: 'ff0000ff' } } }).components.clock.color).toBe('#ff0000ff');
    expect(normalizeConfig({ components: { clock: { color: '#175cd4' } } }).components.clock.color).toBe('#175cd4');
    const c = normalizeConfig({ components: { texts: [{ content: 'x', color: '00ff00' }] } });
    expect(c.components.texts[0].color).toBe('#00ff00');
  });

  it('非法 color 回退 undefined', () => {
    expect(normalizeConfig({ components: { clock: { color: '' } } }).components.clock.color).toBeUndefined();
    expect(normalizeConfig({ components: { clock: { color: '  ' } } }).components.clock.color).toBeUndefined();
    expect(normalizeConfig({ components: { clock: { color: 123 } } }).components.clock.color).toBeUndefined();
    expect(normalizeConfig({ components: { clock: { color: '#xyz' } } }).components.clock.color).toBeUndefined();
    expect(normalizeConfig({ components: { clock: { color: 'not a color!' } } }).components.clock.color).toBeUndefined();
  });

  it('calendar/lunar/weather 同样支持 layout 与 color', () => {
    const c = normalizeConfig({
      components: {
        calendar: { layout: { x: 10, y: 20, w: 30 }, color: '#00ff00' },
        lunar: { layout: { x: 40, y: 50, w: 20 }, color: 'blue' },
        weather: { layout: { x: 70, y: 80, w: 15 }, color: 'rgb(1,2,3)' },
      },
    });
    expect(c.components.calendar.layout).toEqual({ x: 10, y: 20, w: 30 });
    expect(c.components.calendar.color).toBe('#00ff00');
    expect(c.components.lunar.layout).toEqual({ x: 40, y: 50, w: 20 });
    expect(c.components.lunar.color).toBe('blue');
    expect(c.components.weather.layout).toEqual({ x: 70, y: 80, w: 15 });
    expect(c.components.weather.color).toBe('rgb(1,2,3)');
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

  it('texts 过滤无 content 项，保留 layout 与 color', () => {
    const c = normalizeConfig({
      components: {
        texts: [
          { content: '你好', layout: { x: 10, y: 20, w: 30 }, color: '#ff0000' },
          { position: 'center' },
          { content: '{a.b}' },
        ],
      },
    });
    expect(c.components.texts).toHaveLength(2);
    expect(c.components.texts[0].layout).toEqual({ x: 10, y: 20, w: 30 });
    expect(c.components.texts[0].color).toBe('#ff0000');
    // 缺省 layout 回退默认
    expect(c.components.texts[1].layout).toEqual({ x: 15, y: 10, w: 30 });
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
