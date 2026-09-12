/**
 * 插件体系公共类型。
 *
 * 覆盖：属性 schema 字段（元数据驱动属性面板）、插件通用元数据（表盘/内容组件共用）、
 * 插件包清单（plugin.json）与后端持久化的安装记录。
 *
 * 纯类型 + 常量，无 DOM 依赖，可被 ui / editor / runtime 各层与单测引用。
 */

import type { Component } from 'vue';

/** 表盘大类：数字 / 模拟 */
export type FaceKind = 'digital' | 'analog';

/** 插件来源：系统内置 / 第三方安装 */
export type PluginSource = 'builtin' | 'thirdparty';

// 安装记录/清单为纯数据契约，统一定义在 core/pluginTypes.ts，这里再导出统一导入面
export type { PluginKind, PluginChannel, PluginManifest, PluginRecord } from '@/core/pluginTypes';

/** 属性字段控件类型 */
export type PropertyFieldType = 'color' | 'number' | 'boolean' | 'select' | 'text' | 'textarea';

/**
 * 属性字段写回目标：
 *   - 'option'（默认）→ component.options[key]（内置与第三方统一走 options 透传）
 *   - 'field'         → 组件类型顶层字段（如 calendar.week_start，保持单一数据源）
 */
export type PropertyBind = 'option' | 'field';

/** select 字段候选项 */
export interface PropertyFieldOption {
  label: string;
  value: string | number;
}

/**
 * 元数据驱动的属性字段声明。
 * 组件在 meta 中声明该数组，属性面板据此动态渲染控件并写回 bind 目标。
 */
export interface PropertyField {
  /** 字段键（options[key] 或顶层字段名） */
  key: string;
  /** 中文标签 */
  label: string;
  /** 控件类型 */
  type: PropertyFieldType;
  /** 写回目标，缺省 'option' */
  bind?: PropertyBind;
  /** 默认值（仅展示占位，不写入草稿） */
  default?: unknown;
  /** number 约束 */
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  /** select 候选项 */
  options?: PropertyFieldOption[];
  /** 分组标题（同组字段聚合显示） */
  group?: string;
  /** 字段提示 */
  hint?: string;
}

/** 插件通用元数据（表盘与内容组件共用） */
export interface PluginMeta {
  /** 作者 */
  author?: string;
  /** 版本号 */
  version?: string;
  /** 一句话简介（卡片展示） */
  summary?: string;
  /** 详细介绍（详情页展示） */
  description?: string;
  /** 使用指南（详情页展示） */
  usage?: string;
  /** 主页 / 仓库链接（仅展示文本，不发起请求） */
  homepage?: string;
  /** 开源协议 */
  license?: string;
  /** 是否运行时安装（第三方安装项为 true） */
  installed?: boolean;
  /** 属性 schema（元数据驱动属性面板） */
  schema?: PropertyField[];
}

/** 表盘插件注册元数据（registerFace 入参） */
export interface FacePluginMeta extends PluginMeta {
  id: string;
  label: string;
  kind: FaceKind;
  component: Component;
}

/** 内容组件插件注册元数据（registerWidget 入参） */
export interface WidgetPluginMeta extends PluginMeta {
  type: string;
  style: string;
  label: string;
  component: Component;
}
