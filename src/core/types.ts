/**
 * SnoozePanel 配置类型定义与默认值。
 *
 * 配置写在仪表板视图 raw YAML 的 `snoozepanel:` 段。
 * 所有字段均可选，缺省时套用 DEFAULT_CONFIG。
 */

/** 九宫格位置或绝对坐标 */
export type GridPosition =
  | 'top_left' | 'top_center' | 'top_right'
  | 'center_left' | 'center' | 'center_right'
  | 'bottom_left' | 'bottom_center' | 'bottom_right';

export interface AbsolutePosition {
  /** 距左百分比 0-100 */
  x: number;
  /** 距顶百分比 0-100 */
  y: number;
}

export type Position = GridPosition | AbsolutePosition;

export function isAbsolutePosition(p: Position): p is AbsolutePosition {
  return typeof p === 'object' && p !== null && 'x' in p && 'y' in p;
}

/** 设备白/黑名单 */
export interface DeviceFilter {
  mode: 'whitelist' | 'blacklist';
  list: string[];
}

/** 实体条件（state / above / below 三选一或组合） */
export interface EntityCondition {
  entity: string;
  /** 精确匹配状态字符串 */
  state?: string;
  /** 数值大于 */
  above?: number;
  /** 数值小于 */
  below?: number;
}

/** 时间段条件 */
export interface TimeCondition {
  /** 起始时间 "HH:mm"（可跨午夜） */
  after?: string;
  /** 结束时间 "HH:mm" */
  before?: string;
  /** 星期限定 mon..sun */
  weekday?: Weekday[];
}

export type Weekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

/** 日出日落条件（分钟偏移） */
export interface SunCondition {
  /** 日落后 N 分钟才满足（可为负表示日落前） */
  after_sunset_offset?: number;
  /** 日出前 N 分钟才满足 */
  before_sunrise_offset?: number;
}

export interface Conditions {
  entity?: EntityCondition[];
  time?: TimeCondition;
  sun?: SunCondition;
}

/** 时钟组件 */
export interface ClockComponent {
  show: boolean;
  style: 'digital' | 'analog';
  hour24: boolean;
  seconds: boolean;
  position: Position;
}

/** 日历组件 */
export interface CalendarComponent {
  show: boolean;
  /** 周起始日 0=周日 1=周一 */
  week_start: 0 | 1;
  show_week_number: boolean;
  /** 日期格式模板，如 "M月D日 dddd" */
  format: string;
  position: Position;
}

/** 农历组件 */
export interface LunarComponent {
  show: boolean;
  /** 格式模板，占位符 {lunar_month}{lunar_day}{ganzhi}{zodiac} */
  format: string;
  position: Position;
}

/** 天气组件 */
export interface WeatherComponent {
  show: boolean;
  entity: string;
  position: Position;
}

/** 自定义文本（支持实体占位符 {entity_id}） */
export interface TextComponent {
  content: string;
  position: Position;
}

export interface Components {
  clock: ClockComponent;
  calendar: CalendarComponent;
  lunar: LunarComponent;
  weather: WeatherComponent;
  texts: TextComponent[];
}

/** 背景 */
export interface Background {
  type: 'color' | 'gradient' | 'image';
  color: string;
  gradient: { from: string; to: string; angle: number };
  /** 图片 URL 列表，多张轮播 */
  images: string[];
  interval_seconds: number;
  /** 暗化遮罩透明度 0-1 */
  dim: number;
}

/** 完整配置 */
export interface SnoozeConfig {
  enabled: boolean;
  devices: DeviceFilter | null;
  idle_seconds: number;
  exit_cooldown_seconds: number;
  /** input_boolean 实体，用于 HA 自动化远程强制进出屏保 */
  screensaver_entity: string | null;
  conditions: Conditions;
  components: Components;
  background: Background;
  /** 整体显隐 JS 表达式 */
  display_template: string | null;
  /** 单组件显隐 JS 表达式 */
  component_templates: Record<string, string>;
  theme: 'midnight' | 'paper';
}

export const DEFAULT_CONFIG: SnoozeConfig = {
  enabled: true,
  devices: null,
  idle_seconds: 60,
  exit_cooldown_seconds: 2,
  screensaver_entity: null,
  conditions: {},
  components: {
    clock: { show: true, style: 'digital', hour24: true, seconds: false, position: 'center' },
    calendar: { show: true, week_start: 1, show_week_number: false, format: 'M月D日 dddd', position: 'bottom_center' },
    lunar: { show: false, format: '{lunar_month}{lunar_day}', position: 'bottom_center' },
    weather: { show: false, entity: '', position: 'top_right' },
    texts: [],
  },
  background: {
    type: 'color',
    color: '#0b1020',
    gradient: { from: '#0b1020', to: '#1b2a4a', angle: 160 },
    images: [],
    interval_seconds: 30,
    dim: 0.45,
  },
  display_template: null,
  component_templates: {},
  theme: 'midnight',
};
