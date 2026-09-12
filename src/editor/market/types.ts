/**
 * 市场（表盘 / 内容组件）共享类型。
 *
 * 把「表盘选项」与「内容组件样式选项」归一化为统一的 MarketEntry，
 * 供 MarketCard / MarketDetail 与两个市场复用，避免样式与逻辑重复。
 */

/** 市场条目（表盘或内容组件样式的统一视图） */
export interface MarketEntry {
  /** 唯一键：face = 表盘 id；widget = `type/style` */
  key: string;
  /** 选中时写回草稿的值：face = 表盘 id；widget = 样式 id */
  value: string;
  /** 中文显示名 */
  label: string;
  /** 来源：系统内置 / 第三方安装 */
  source: 'builtin' | 'thirdparty';
  /** 是否为当前「使用中」 */
  inUse: boolean;
  /** 副标签：face 用「数字 / 模拟」，widget 用类型中文名 */
  kindLabel?: string;
  /** widget 类型 / 样式（卸载定位用） */
  type?: string;
  style?: string;
  summary?: string;
  author?: string;
  version?: string;
  description?: string;
  usage?: string;
  homepage?: string;
  license?: string;
  /** 是否运行时安装（第三方安装项为 true，可卸载） */
  installed?: boolean;
  /** 是否启用（仅第三方安装项有意义） */
  enabled?: boolean;
}
