/**
 * 内容组件（widget）公共类型：所有内容组件入口（widgets/<id>/index.vue）接收的统一 props。
 *
 * 内容组件据此渲染：时间/实体/主题/自定义选项。
 *   - now / hass / theme 为运行环境注入的只读上下文；
 *   - options 为该组件的配置透传位（内置字段 + 第三方自定义字段合并），
 *     组件应在此读取自己关心的键（如 format / entity / content / week_start）。
 *   - color 为可选自定义字体颜色（缺省使用主题色）。
 *
 * theme 来自 src/ui/themes.ts，保证 midnight/paper 两主题协调。
 */

import type { Component } from 'vue';
import type { HassLike } from '@/core/hass';
import type { Theme } from '../themes';

/** 内容组件入口组件的统一 props */
export interface WidgetProps {
  /** 当前时间（由 mount 层 1s tick 驱动） */
  now: Date;
  /** Home Assistant hass 对象（读实体状态用） */
  hass: HassLike;
  /** 当前主题（取色 / 字重 / 字体族） */
  theme: Theme;
  /** 该组件类型配置（内置字段 + options 透传合并） */
  options: Record<string, unknown>;
  /** 自定义字体颜色（可选，覆盖主题色） */
  color?: string;
}

/** 内容组件来源：系统内置 / 第三方安装 */
export type WidgetSource = 'builtin' | 'thirdparty';

/** 内容组件元数据 + 入口组件 */
export interface WidgetMeta {
  /** 组件类型唯一 id（目录名）：calendar / date / lunar / weather / text */
  id: string;
  /** 中文显示名（编辑器下拉用） */
  label: string;
  /** 来源：builtin（系统内置）/ thirdparty（第三方安装） */
  source: WidgetSource;
  /** 入口组件 */
  component: Component;
}

/** 纯数据形态的内容组件摘要（不含组件引用，可安全跨序列化边界传递） */
export interface WidgetOption {
  /** 组件类型唯一 id（目录名） */
  id: string;
  /** 中文显示名 */
  label: string;
  /** 来源：builtin / thirdparty */
  source: WidgetSource;
}
