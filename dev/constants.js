// @ts-check
/**
 * dev 实测台常量（集中管理，供各 dev 模块引用）。
 */

/** 屏保强制实体（触发通路核心，配置内固定写入；与 mock hass 对齐） */
export const SCREENSAVER_ENTITY = 'input_boolean.screensaver';
/** 退出冷却秒数（与运行时配置一致；用于状态徽标展示） */
export const EXIT_COOLDOWN_SECONDS = 2;
/** 初始闲置秒数（编辑器首次挂载的默认值，之后以编辑器内配置为准） */
export const DEFAULT_IDLE_SECONDS = 15;
/** 构建产物路径（相对 dev/ 页面；保留 ?t= 做缓存穿透） */
export const BUNDLE_URL = '../tmp/dist/snoozepanel.js';
/** 日志条目上限（超出丢弃最旧条目，防止 DOM 无限膨胀） */
export const LOG_LIMIT = 300;
/** 实测台 UI 布局偏好 key（仅 UI 偏好，不涉及插件配置） */
export const DEV_LAYOUT_KEY = 'snoozepanel.dev.layout';
/** 底栏最小高度（px） */
export const BOTTOM_MIN = 120;
/** 底栏默认高度（px） */
export const BOTTOM_DEFAULT = 200;
