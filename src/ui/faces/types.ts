/**
 * 表盘公共类型：所有表盘入口组件（faces/<id>/index.vue）接收的统一 props。
 *
 * 表盘据此渲染时间与配色；theme 来自 src/ui/themes.ts，保证 midnight/paper 两主题协调。
 */

import type { Theme } from '../themes';

/** 表盘入口组件的统一 props */
export interface FaceProps {
  /** 当前时间（由 mount 层 1s tick 驱动） */
  now: Date;
  /** 是否显示秒（秒针 / 秒位 / 环形进度） */
  seconds: boolean;
  /** 是否 24 小时制（数字表盘用；模拟表盘可忽略） */
  hour24: boolean;
  /** 当前主题（取色/字重/字体族） */
  theme: Theme;
}
