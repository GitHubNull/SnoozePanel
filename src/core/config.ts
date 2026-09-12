/**
 * 配置规范化：把用户 YAML 中的松散配置合并到默认值，做类型容错。
 * 任何非法字段静默回退默认，不抛异常（保证屏保在主循环中稳健）。
 *
 * 布局体系：全部组件使用 ComponentLayout（x/y/w/h 百分比），
 * 旧版 position 字段（九宫格字符串/绝对坐标）一律忽略，回退默认布局。
 */

import {
  DEFAULT_CONFIG,
  type SnoozeConfig,
  type ComponentLayout,
  type DeviceFilter,
  type EntityCondition,
  type Weekday,
} from './types';

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function num(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function str(v: unknown, fallback: string): string {
  return typeof v === 'string' ? v : fallback;
}

function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === 'boolean' ? v : fallback;
}

function strOrNull(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

/** 夹取数值到 [min, max] */
function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/**
 * 规范化组件布局。
 * 合法输入：{ x: number, y: number, w: number, h?: number }，各字段夹取 0-100。
 * 非法输入（含旧版 position 字段）回退 fallback。
 */
function normalizeLayout(v: unknown, fallback: ComponentLayout): ComponentLayout {
  if (!isObject(v)) return { ...fallback };
  const x = num(v.x, fallback.x);
  const y = num(v.y, fallback.y);
  const w = num(v.w, fallback.w);
  const h = typeof v.h === 'number' ? v.h : fallback.h;
  return {
    x: clamp(x, 0, 100),
    y: clamp(y, 0, 100),
    w: clamp(w, 0, 100),
    ...(h !== undefined ? { h: clamp(h, 0, 100) } : {}),
  };
}

/**
 * 补齐 hex 前导 '#'。
 * PrimeVue ColorPicker（format="hex"）输出形如 `175cd4` 的裸 hex（见其 RGBtoHEX），
 * 并非合法 CSS 颜色；这里仅对「完整长度」的裸 hex（3/4/6/8 位）补 '#'，
 * 其余字符串原样返回，避免打断编辑器逐字符输入。
 */
export function attachHexHash(v: string): string {
  const s = v.trim();
  return /^(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(s) ? `#${s}` : v;
}

/**
 * 规范化字体颜色（配置加载容错）。
 * 合法：非空字符串（hex / rgb / rgba / 颜色名）透传，裸 hex 自动补 '#'。
 * 非法：回退 undefined（使用主题色）。
 */
function normalizeColor(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const s = v.trim();
  if (!s) return undefined;
  const colored = attachHexHash(s);
  // 简单校验：#hex / rgb( / rgba( / 字母开头颜色名
  if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(colored)) return colored;
  if (/^rgba?\(/.test(colored)) return colored;
  if (/^[a-zA-Z]+$/.test(colored)) return colored;
  return undefined;
}

function normalizeDevices(v: unknown): DeviceFilter | null {
  if (!isObject(v)) return null;
  const mode = v.mode === 'whitelist' || v.mode === 'blacklist' ? v.mode : null;
  const list = Array.isArray(v.list) ? v.list.filter((x): x is string => typeof x === 'string') : [];
  if (!mode) return null;
  return { mode, list };
}

const WEEKDAYS: Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

function normalizeEntityConditions(v: unknown): EntityCondition[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out: EntityCondition[] = [];
  for (const item of v) {
    if (!isObject(item) || typeof item.entity !== 'string') continue;
    const c: EntityCondition = { entity: item.entity };
    if (typeof item.state === 'string') c.state = item.state;
    if (typeof item.above === 'number') c.above = item.above;
    if (typeof item.below === 'number') c.below = item.below;
    out.push(c);
  }
  return out.length ? out : undefined;
}

/** 各组件默认布局（与 DEFAULT_CONFIG 一致，供 normalizeLayout 回退用） */
const FALLBACK_LAYOUTS = {
  clock: DEFAULT_CONFIG.components.clock.layout,
  calendar: DEFAULT_CONFIG.components.calendar.layout,
  lunar: DEFAULT_CONFIG.components.lunar.layout,
  weather: DEFAULT_CONFIG.components.weather.layout,
  text: { x: 15, y: 10, w: 30 } as ComponentLayout,
};

/**
 * 规范化完整配置。raw 为视图 YAML 中 `snoozepanel:` 段的对象。
 */
export function normalizeConfig(raw: unknown): SnoozeConfig {
  const d = DEFAULT_CONFIG;
  if (!isObject(raw)) {
    return structuredClone(d);
  }

  const comp = isObject(raw.components) ? raw.components : {};
  const clock = isObject(comp.clock) ? comp.clock : {};
  const calendar = isObject(comp.calendar) ? comp.calendar : {};
  const lunar = isObject(comp.lunar) ? comp.lunar : {};
  const weather = isObject(comp.weather) ? comp.weather : {};
  const bg = isObject(raw.background) ? raw.background : {};
  const gradient = isObject(bg.gradient) ? bg.gradient : {};
  const conds = isObject(raw.conditions) ? raw.conditions : {};
  const time = isObject(conds.time) ? conds.time : {};
  const sun = isObject(conds.sun) ? conds.sun : {};

  const texts = Array.isArray(comp.texts)
    ? comp.texts
        .filter((t): t is Record<string, unknown> => isObject(t) && typeof t.content === 'string')
        .map((t) => ({
          content: t.content as string,
          layout: normalizeLayout(t.layout, FALLBACK_LAYOUTS.text),
          color: normalizeColor(t.color),
        }))
    : [];

  const componentTemplates: Record<string, string> = {};
  if (isObject(raw.component_templates)) {
    for (const [k, v] of Object.entries(raw.component_templates)) {
      if (typeof v === 'string') componentTemplates[k] = v;
    }
  }

  const bgType = bg.type === 'gradient' || bg.type === 'image' ? bg.type : 'color';
  const theme = raw.theme === 'paper' ? 'paper' : 'midnight';

  return {
    enabled: bool(raw.enabled, d.enabled),
    devices: normalizeDevices(raw.devices),
    idle_seconds: Math.max(5, num(raw.idle_seconds, d.idle_seconds)),
    exit_cooldown_seconds: Math.max(0, num(raw.exit_cooldown_seconds, d.exit_cooldown_seconds)),
    screensaver_entity: strOrNull(raw.screensaver_entity),
    conditions: {
      entity: normalizeEntityConditions(conds.entity),
      time: isObject(conds.time)
        ? {
            after: strOrNull(time.after) ?? undefined,
            before: strOrNull(time.before) ?? undefined,
            weekday: Array.isArray(time.weekday)
              ? (time.weekday.filter((w): w is Weekday => WEEKDAYS.includes(w as Weekday)) as Weekday[])
              : undefined,
          }
        : undefined,
      sun: isObject(conds.sun)
        ? {
            after_sunset_offset: typeof sun.after_sunset_offset === 'number' ? sun.after_sunset_offset : undefined,
            before_sunrise_offset: typeof sun.before_sunrise_offset === 'number' ? sun.before_sunrise_offset : undefined,
          }
        : undefined,
    },
    components: {
      clock: {
        show: bool(clock.show, d.components.clock.show),
        // style 为表盘 id：非空字符串即透传，是否真实存在由渲染层 getFace 回退兜底；
        // core 纯函数层不依赖 ui 注册表，保持纯净。
        style: typeof clock.style === 'string' && clock.style.trim() ? clock.style.trim() : d.components.clock.style,
        hour24: bool(clock.hour24, d.components.clock.hour24),
        seconds: bool(clock.seconds, d.components.clock.seconds),
        layout: normalizeLayout(clock.layout, FALLBACK_LAYOUTS.clock),
        color: normalizeColor(clock.color),
      },
      calendar: {
        show: bool(calendar.show, d.components.calendar.show),
        week_start: calendar.week_start === 0 ? 0 : 1,
        show_week_number: bool(calendar.show_week_number, d.components.calendar.show_week_number),
        format: str(calendar.format, d.components.calendar.format),
        layout: normalizeLayout(calendar.layout, FALLBACK_LAYOUTS.calendar),
        color: normalizeColor(calendar.color),
      },
      lunar: {
        show: bool(lunar.show, d.components.lunar.show),
        format: str(lunar.format, d.components.lunar.format),
        layout: normalizeLayout(lunar.layout, FALLBACK_LAYOUTS.lunar),
        color: normalizeColor(lunar.color),
      },
      weather: {
        show: bool(weather.show, d.components.weather.show),
        entity: str(weather.entity, d.components.weather.entity),
        layout: normalizeLayout(weather.layout, FALLBACK_LAYOUTS.weather),
        color: normalizeColor(weather.color),
      },
      texts,
    },
    background: {
      type: bgType,
      color: str(bg.color, d.background.color),
      gradient: {
        from: str(gradient.from, d.background.gradient.from),
        to: str(gradient.to, d.background.gradient.to),
        angle: num(gradient.angle, d.background.gradient.angle),
      },
      images: Array.isArray(bg.images) ? bg.images.filter((x): x is string => typeof x === 'string') : [],
      interval_seconds: Math.max(3, num(bg.interval_seconds, d.background.interval_seconds)),
      dim: Math.min(1, Math.max(0, num(bg.dim, d.background.dim))),
    },
    display_template: strOrNull(raw.display_template),
    component_templates: componentTemplates,
    theme,
  };
}
