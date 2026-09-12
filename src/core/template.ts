/**
 * display_template JS 表达式安全求值。
 *
 * 用 new Function 构造受限作用域，注入 hass / states / user 上下文。
 * 任何异常都优雅降级：返回默认值（true=显示），并仅 warn 一次避免刷屏。
 */

import type { HassLike } from './hass';

const warned = new Set<string>();

/**
 * 求值显隐表达式。
 * @param expr  JS 表达式字符串，应返回布尔值
 * @param hass  hass 对象
 * @param fallback  表达式为空或异常时的默认返回值
 */
export function evalTemplate(expr: string | null | undefined, hass: HassLike, fallback = true): boolean {
  if (!expr || !expr.trim()) return fallback;

  try {
    const fn = new Function('hass', 'states', 'user', `"use strict"; return (${expr});`);
    const result = fn(hass, hass.states, hass.user);
    return Boolean(result);
  } catch (err) {
    if (!warned.has(expr)) {
      warned.add(expr);
      console.warn('[SnoozePanel] display_template 求值失败，已降级为默认显隐：', expr, err);
    }
    return fallback;
  }
}
