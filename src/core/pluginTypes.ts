/**
 * 插件安装的纯数据契约（无 vue / DOM 依赖）。
 *
 * 供 core（pluginStore 读写后端）与 ui（编辑器安装弹窗、注册表）共用，
 * 避免 core 反向依赖 ui 层。
 */

/** 插件种类：表盘 / 内容组件 */
export type PluginKind = 'face' | 'widget';

/** 安装通道：HA 本地目录 / 文件上传 */
export type PluginChannel = 'dir' | 'upload';

/** 插件包清单（<id>/plugin.json，供构建工具与人工阅读） */
export interface PluginManifest {
  /** 插件唯一 id（同时用于目录名，需满足 id 规则） */
  id: string;
  /** 种类：表盘 / 内容组件 */
  kind: PluginKind;
  /** 显示名 */
  label?: string;
  /** widget 类型 id（kind=widget 时必填） */
  type?: string;
  /** widget 样式 id（kind=widget 时必填） */
  style?: string;
  /** 入口文件名（缺省 index.js） */
  entry?: string;
  /** 目标 SDK 版本 */
  apiVersion?: number;
  author?: string;
  version?: string;
  summary?: string;
  description?: string;
  usage?: string;
  homepage?: string;
  license?: string;
}

/** 后端持久化的插件安装记录 */
export interface PluginRecord {
  /** 插件 id */
  id: string;
  /** 种类 */
  kind: PluginKind;
  /** 安装通道 */
  channel: PluginChannel;
  /** 入口文件名（dir 通道用于拼装 /local 路径） */
  entry: string;
  /** 是否启用（禁用后启动时不加载） */
  enabled: boolean;
  /** 插件清单 */
  manifest: PluginManifest;
  /** 上传通道的脚本文本（dir 通道为空） */
  code?: string;
  /** 安装时间戳（毫秒） */
  installed_at?: number;
}
