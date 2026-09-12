// @ts-check
/**
 * dev 实测台的运行时配置构建与读取。
 *
 * 配置以「内嵌编辑器」为单一来源：buildBaseConfig 仅提供编辑器首次挂载的初始值，
 * currentConfig 则读取编辑器当前配置。
 */
import { DEFAULT_IDLE_SECONDS, EXIT_COOLDOWN_SECONDS, SCREENSAVER_ENTITY } from './constants.js';
import { state } from './state.js';

/**
 * 组装初始运行时配置（内嵌编辑器首次挂载用；固定 screensaver_entity 触发通路）。
 * 之后一切配置以编辑器为单一来源，本函数仅提供编辑器初始值。
 */
export function buildBaseConfig() {
  return {
    enabled: true,
    idle_seconds: DEFAULT_IDLE_SECONDS,
    exit_cooldown_seconds: EXIT_COOLDOWN_SECONDS,
    theme: 'midnight',
    screensaver_entity: SCREENSAVER_ENTITY,
    components: {
      clock: { show: true, style: 'digital', hour24: true, seconds: true, layout: { x: 50, y: 40, w: 55 } },
      calendar: { show: true, week_start: 1, show_week_number: true, format: 'M月D日 dddd', layout: { x: 50, y: 72, w: 32 } },
      lunar: { show: true, format: '{lunar_month}{lunar_day} {ganzhi}{zodiac}年', layout: { x: 50, y: 93, w: 30 } },
      weather: { show: true, entity: 'weather.home', layout: { x: 82, y: 12, w: 28 } },
      texts: [{ content: '室温 {sensor.temp}°C', layout: { x: 16, y: 12, w: 30 } }],
    },
    background: {
      type: 'color', color: '#0b1020',
      gradient: { from: '#0b1020', to: '#1b2a4a', angle: 160 },
      images: [], interval_seconds: 30, dim: 0.45,
    },
  };
}

/** 读取编辑器当前配置（编辑器为单一来源；未就绪时回退初始配置）。 */
export function currentConfig() {
  return state.editorHandle ? state.editorHandle.getConfig() : buildBaseConfig();
}
