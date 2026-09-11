/**
 * SnoozePanel 入口。
 *
 * 作为 HA「资源」（resource）加载的单文件 JS：
 *  - 注册 `snoozepanel` 自定义元素（视图级门控载体）
 *  - 注册可视化配置编辑器（card GUI editor）
 *  - 向 window.customCards 声明，便于 HA 卡片选择器识别
 */

import { registerSnoozePanel } from './panel';
import { registerSnoozePanelEditor } from './editor/editor';

registerSnoozePanel();
registerSnoozePanelEditor();

// 向 HA 卡片选择器声明
interface CustomCardEntry {
  type: string;
  name: string;
  description: string;
  preview?: boolean;
}

declare global {
  interface Window {
    customCards?: CustomCardEntry[];
  }
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: 'snooze-panel',
  name: 'SnoozePanel 屏保',
  description: '在所属视图启用闲置屏保（时钟/日历/农历/天气/背景）。配置写在视图 snoozepanel: 段。',
  preview: false,
});

// eslint-disable-next-line no-console
console.info(
  '%c SnoozePanel %c 已加载 ',
  'background:#5ea0ff;color:#fff;padding:2px 4px;border-radius:3px 0 0 3px',
  'background:#223;color:#fff;padding:2px 4px;border-radius:0 3px 3px 0',
);
