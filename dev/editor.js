// @ts-check
/**
 * dev 实测台：内嵌真实配置编辑器（常驻单例）的创建与配置变更桥接。
 *
 * 配置以编辑器为单一来源：编辑器变更（config-changed）实时回填给运行中的面板元素
 * （与 HA 收到 config-changed 后回填 setConfig 一致）。
 */
import { el, state } from './state.js';
import { log, toast } from './log.js';
import { buildBaseConfig, currentConfig } from './config.js';
import { mockHass } from './mock.js';
import { updateDirtyBadge } from './runtime.js';

/** 在主内容区创建真实编辑器（常驻单例）；创建后以编辑器为配置单一来源。 */
export function ensureEditor() {
  if (state.editorHandle) return;
  const api = state.api;
  if (!api) {
    log('error', '产物未加载，无法创建编辑器');
    toast('error', '编辑器不可用', '请先加载构建产物。');
    return;
  }
  const initial = buildBaseConfig();
  state.editorHandle = api.mountEditor(el.stageBoard, initial, mockHass);
  // 与 HA 一致：编辑器配置变化（config-changed）即回填给运行中的面板元素，无需手动「重新应用」
  el.stageBoard.addEventListener('config-changed', handleEditorConfigChanged);
  // 初始基线：编辑器未被改动时视为「已同步」
  state.appliedSnapshot = initial;
  log('ok', '配置编辑器已内嵌（菜单栏 / 分类区 / 预览画布 / 属性区 / 状态栏）');
  updateDirtyBadge();
}

/**
 * 编辑器配置变化（config-changed）→ 热推给运行中的运行时。
 * 与 HA 行为一致：HA 收到 config-changed 后会把新配置回填给卡片元素的 setConfig；
 * 本地实测台编辑器与面板元素相互独立，故在此显式桥接，
 * 避免「编辑后触发屏保仍是默认布局/颜色」。
 */
export function handleEditorConfigChanged() {
  const config = currentConfig();
  state.appliedSnapshot = config;
  if (state.panelEl) state.panelEl.setConfig({ snoozepanel: config });
  updateDirtyBadge();
}
