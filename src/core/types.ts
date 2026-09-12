/**
 * SnoozePanel 配置类型定义与默认值。
 *
 * 配置写在仪表板视图 raw YAML 的 `snoozepanel:` 段。
 * 所有字段均可选，缺省时套用 DEFAULT_CONFIG。
 *
 * 布局体系：全部组件使用自由坐标 + 尺寸（ComponentLayout），
 * 无九宫格/绝对坐标旧类型，无向后兼容代码。
 */

import { DEFAULT_SCREEN, type ScreenSize } from './screen';

/** 组件自由布局（百分比坐标 + 尺寸） */
export interface ComponentLayout {
  /** 距左百分比 0-100 */
  x: number;
  /** 距顶百分比 0-100 */
  y: number;
  /** 宽度百分比 0-100 */
  w: number;
  /** 高度百分比 0-100（可选，缺省内容自适应） */
  h?: number;
  /** 图层序（可选，越大越靠前；缺省按组件清单顺序） */
  z?: number;
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
  /** 表盘 id（对应 src/ui/faces/<id>/），如 digital / analog / chrono / minimal / ring / orbit */
  style: string;
  hour24: boolean;
  seconds: boolean;
  layout: ComponentLayout;
  /** 自定义字体颜色（覆盖主题色，如 "#ff0000" / "rgb(255,0,0)"） */
  color?: string;
}

/** 日历组件 */
export interface CalendarComponent {
  show: boolean;
  /** 样式 id（对应 src/ui/widgets/calendar/<style>/），如 basic / compact / minimal */
  style: string;
  /** 周起始日 0=周日 1=周一 */
  week_start: 0 | 1;
  show_week_number: boolean;
  /** 日期格式模板，如 "M月D日 dddd" */
  format: string;
  layout: ComponentLayout;
  /** 自定义字体颜色 */
  color?: string;
  /** 第三方组件自定义配置透传（内置渲染忽略，供插件消费） */
  options?: Record<string, unknown>;
}

/** 日期组件（公历日期文本，支持 ISO 8601 占位符） */
export interface DateComponent {
  show: boolean;
  /** 样式 id（对应 src/ui/widgets/date/<style>/），如 basic / badge / stacked */
  style: string;
  /** 日期格式模板，占位符 YYYY/YY/MM/M/DD/D/dddd/ddd */
  format: string;
  layout: ComponentLayout;
  /** 自定义字体颜色 */
  color?: string;
  /** 第三方组件自定义配置透传（内置渲染忽略，供插件消费） */
  options?: Record<string, unknown>;
}

/** 农历组件 */
export interface LunarComponent {
  show: boolean;
  /** 样式 id（对应 src/ui/widgets/lunar/<style>/），如 basic / pill / detail */
  style: string;
  /** 格式模板，占位符 {lunar_month}{lunar_day}{ganzhi}{zodiac} */
  format: string;
  layout: ComponentLayout;
  /** 自定义字体颜色 */
  color?: string;
  /** 第三方组件自定义配置透传（内置渲染忽略，供插件消费） */
  options?: Record<string, unknown>;
}

/** 天气组件 */
export interface WeatherComponent {
  show: boolean;
  /** 样式 id（对应 src/ui/widgets/weather/<style>/），如 basic / card / inline */
  style: string;
  entity: string;
  layout: ComponentLayout;
  /** 自定义字体颜色 */
  color?: string;
  /** 第三方组件自定义配置透传（内置渲染忽略，供插件消费） */
  options?: Record<string, unknown>;
}

/** 自定义文本（支持实体占位符 {entity_id}） */
export interface TextComponent {
  content: string;
  /** 样式 id（对应 src/ui/widgets/text/<style>/），如 basic / badge / quote */
  style: string;
  layout: ComponentLayout;
  /** 是否显示（缺省视为显示，兼容旧配置）；关闭后屏保不渲染该项 */
  show?: boolean;
  /** 自定义字体颜色 */
  color?: string;
  /** 第三方组件自定义配置透传（内置渲染忽略，供插件消费） */
  options?: Record<string, unknown>;
}

export interface Components {
  clock: ClockComponent;
  calendar: CalendarComponent;
  date: DateComponent;
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
  /** 编辑器模拟设备的屏幕尺寸（仅影响预览，生产屏保始终全屏） */
  screen: ScreenSize;
}

/** 默认布局：各组件的初始位置与尺寸（w 同时作为内容缩放的「1x」基准宽度） */
export const DEFAULT_LAYOUTS = {
  clock: { x: 50, y: 50, w: 60 } as ComponentLayout,
  calendar: { x: 50, y: 85, w: 40 } as ComponentLayout,
  date: { x: 50, y: 20, w: 30 } as ComponentLayout,
  lunar: { x: 50, y: 92, w: 30 } as ComponentLayout,
  weather: { x: 85, y: 10, w: 25 } as ComponentLayout,
  text: { x: 15, y: 10, w: 30 } as ComponentLayout,
};

/**
 * 组件内容缩放的「1x」基准宽度（%）。
 * 布局宽度等于基准宽度时缩放比为 1；布局宽度与基准宽度的比值即为缩放比，
 * 因此拖动缩放手柄 / 修改宽度即可实时等比放大或缩小组件内容。
 * @param key 组件键（clock / calendar / lunar / weather / text_N）
 */
export function baseWidthFor(key: string): number {
  if (key.startsWith('text_')) return DEFAULT_LAYOUTS.text.w;
  const def = (DEFAULT_LAYOUTS as Record<string, ComponentLayout | undefined>)[key];
  return def ? def.w : 50;
}

export const DEFAULT_CONFIG: SnoozeConfig = {
  enabled: true,
  devices: null,
  idle_seconds: 60,
  exit_cooldown_seconds: 2,
  screensaver_entity: null,
  conditions: {},
  components: {
    clock: { show: true, style: 'digital', hour24: true, seconds: false, layout: DEFAULT_LAYOUTS.clock },
    calendar: { show: true, style: 'basic', week_start: 1, show_week_number: false, format: 'M月D日 dddd', layout: DEFAULT_LAYOUTS.calendar },
    date: { show: false, style: 'basic', format: 'YYYY年MM月DD日 dddd', layout: DEFAULT_LAYOUTS.date },
    lunar: { show: false, style: 'basic', format: '{lunar_month}{lunar_day}', layout: DEFAULT_LAYOUTS.lunar },
    weather: { show: false, style: 'basic', entity: '', layout: DEFAULT_LAYOUTS.weather },
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
  screen: DEFAULT_SCREEN,
};
