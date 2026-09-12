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

  it('texts 的 show 缺省为 true，显式 false 保留', () => {
    const c = normalizeConfig({
      components: {
        texts: [
          { content: 'A', show: true },
          { content: 'B', show: false },
          { content: 'C' },
        ],
      },
    });
    expect(c.components.texts.map((t) => t.show)).toEqual([true, false, true]);
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

  it('screen 缺省取默认尺寸', () => {
    expect(normalizeConfig({}).screen).toEqual(DEFAULT_CONFIG.screen);
    expect(normalizeConfig({ screen: null }).screen).toEqual(DEFAULT_CONFIG.screen);
    expect(normalizeConfig({ screen: 'watch-360' }).screen).toEqual(DEFAULT_CONFIG.screen);
  });

  it('screen 合法 preset + 宽高透传', () => {
    const c = normalizeConfig({ screen: { preset: 'watch-360', width: 360, height: 360 } });
    expect(c.screen).toEqual({ preset: 'watch-360', width: 360, height: 360 });
  });

  it('screen 宽高按实际命中回正 preset', () => {
    // 声明 preset 与宽高不符时，以宽高为准（命中预设即回正，否则自定义）
    expect(normalizeConfig({ screen: { preset: 'watch-360', width: 800, height: 600 } }).screen).toEqual({
      preset: 'custom',
      width: 800,
      height: 600,
    });
    expect(normalizeConfig({ screen: { preset: 'custom', width: 390, height: 844 } }).screen.preset).toBe('phone-390');
  });

  it('screen 宽高夹取到 [120,4096]', () => {
    expect(normalizeConfig({ screen: { width: 10, height: 99999 } }).screen).toEqual({
      preset: 'custom',
      width: 120,
      height: 4096,
    });
  });

  it('screen 仅给 preset 时回填预设宽高', () => {
    expect(normalizeConfig({ screen: { preset: 'phone-390' } }).screen).toEqual({
      preset: 'phone-390',
      width: 390,
      height: 844,
    });
  });

  it('screen 非法 preset 且无宽高回退默认', () => {
    expect(normalizeConfig({ screen: { preset: 'nope' } }).screen).toEqual(DEFAULT_CONFIG.screen);
    expect(normalizeConfig({ screen: { width: 'x', height: 'y' } }).screen).toEqual(DEFAULT_CONFIG.screen);
  });

  it('date 组件规范化（show/format/layout/color）', () => {
    const c = normalizeConfig({
      components: {
        date: { show: true, format: 'YYYY-MM-DD dddd', layout: { x: 10, y: 20, w: 30 }, color: '#123456' },
      },
    });
    expect(c.components.date.show).toBe(true);
    expect(c.components.date.format).toBe('YYYY-MM-DD dddd');
    expect(c.components.date.layout).toEqual({ x: 10, y: 20, w: 30 });
    expect(c.components.date.color).toBe('#123456');
  });

  it('date 缺省 show=false，format 回退默认模板', () => {
    const c = normalizeConfig({ components: { date: {} } });
    expect(c.components.date.show).toBe(DEFAULT_CONFIG.components.date.show);
    expect(c.components.date.format).toBe(DEFAULT_CONFIG.components.date.format);
    expect(c.components.date.layout).toEqual(DEFAULT_CONFIG.components.date.layout);
  });

  it('layout z 夹取 0-999 并取整', () => {
    expect(normalizeConfig({ components: { clock: { layout: { x: 50, y: 50, w: 30, z: -5 } } } }).components.clock.layout.z).toBe(0);
    expect(normalizeConfig({ components: { clock: { layout: { x: 50, y: 50, w: 30, z: 5000 } } } }).components.clock.layout.z).toBe(999);
    expect(normalizeConfig({ components: { clock: { layout: { x: 50, y: 50, w: 30, z: 3.7 } } } }).components.clock.layout.z).toBe(4);
  });

  it('layout z 缺省不输出（向后兼容）', () => {
    const c = normalizeConfig({ components: { clock: { layout: { x: 50, y: 50, w: 30 } } } });
    expect(c.components.clock.layout.z).toBeUndefined();
    expect('z' in c.components.clock.layout).toBe(false);
  });

  it('options 透传 JSON 安全对象（各内容组件）', () => {
    const c = normalizeConfig({
      components: {
        calendar: { options: { week_start: 0, extra: 'x' } },
        date: { options: { format: 'M/D' } },
        lunar: { options: { format: '{ganzhi}' } },
        weather: { options: { entity: 'weather.home' } },
      },
    });
    expect(c.components.calendar.options).toEqual({ week_start: 0, extra: 'x' });
    expect(c.components.date.options).toEqual({ format: 'M/D' });
    expect(c.components.lunar.options).toEqual({ format: '{ganzhi}' });
    expect(c.components.weather.options).toEqual({ entity: 'weather.home' });
  });

  it('options 非对象回退 undefined', () => {
    const c = normalizeConfig({ components: { date: { options: 'nope' }, calendar: { options: [1, 2] } } });
    expect(c.components.date.options).toBeUndefined();
    expect(c.components.calendar.options).toBeUndefined();
  });

  it('texts 的 options 同样透传', () => {
    const c = normalizeConfig({ components: { texts: [{ content: 'x', options: { font_size: 20 } }] } });
    expect(c.components.texts[0].options).toEqual({ font_size: 20 });
  });

  it('calendar/date/lunar/weather 缺省 style 归一为 basic', () => {
    const c = normalizeConfig({ components: {} });
    expect(c.components.calendar.style).toBe('basic');
    expect(c.components.date.style).toBe('basic');
    expect(c.components.lunar.style).toBe('basic');
    expect(c.components.weather.style).toBe('basic');
  });

  it('组件 style 显式传入时透传（去首尾空白）', () => {
    const c = normalizeConfig({
      components: {
        calendar: { style: 'compact' },
        date: { style: 'badge' },
        lunar: { style: ' detail ' },
        weather: { style: 'card' },
        texts: [{ content: 'x', style: 'quote' }],
      },
    });
    expect(c.components.calendar.style).toBe('compact');
    expect(c.components.date.style).toBe('badge');
    expect(c.components.lunar.style).toBe('detail');
    expect(c.components.weather.style).toBe('card');
    expect(c.components.texts[0].style).toBe('quote');
  });

  it('组件 style 空串/非字符串回退 basic', () => {
    const c = normalizeConfig({
      components: {
        calendar: { style: '' },
        date: { style: 123 },
        texts: [{ content: 'x' }],
      },
    });
    expect(c.components.calendar.style).toBe('basic');
    expect(c.components.date.style).toBe('basic');
    expect(c.components.texts[0].style).toBe('basic');
  });
});
