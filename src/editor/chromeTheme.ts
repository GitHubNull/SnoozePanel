/**
 * 编辑器暗色外观的全局启停（引用计数）。
 *
 * PrimeVue 主题以 darkModeSelector='.snooze-editor-dark' 生成深色变量，
 * 而 Popover / Dialog / Toast 默认 appendTo='body'（脱离插件外壳），
 * 故需把该类挂到 document.documentElement 上，使浮层一并获得深色令牌。
 * 多个编辑器宿主（HA 卡片编辑器 / 侧边栏）可能共存，用引用计数避免误删。
 */

/** 暗色外观类名（与 PrimeVue darkModeSelector 一致） */
const CHROME_DARK_CLASS = 'snooze-editor-dark';
/** 当前持有者数量 */
let holders = 0;

/** 申请暗色外观（计数 +1），首个持有者挂类 */
export function acquireChromeTheme(): void {
  holders += 1;
  if (holders === 1) document.documentElement.classList.add(CHROME_DARK_CLASS);
}

/** 释放暗色外观（计数 -1），归零时移除类 */
export function releaseChromeTheme(): void {
  holders = Math.max(0, holders - 1);
  if (holders === 0) document.documentElement.classList.remove(CHROME_DARK_CLASS);
}
