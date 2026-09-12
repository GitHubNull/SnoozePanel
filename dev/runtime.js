// @ts-check
/**
 * dev 实测台的运行时生命周期：挂载 / 重新应用 / 触发 / 退出 / 卸载，
 * 以及运行时状态徽标与按钮可用性刷新。
 *
 * 触发 / 退出走生产同款 screensaver_entity 通路
 * （mock input_boolean 置位 + 重新赋值 el.hass → controller.syncFromEntity）。
 *
 * @typedef {import('./types.js').SnoozeConfig} SnoozeConfig
 */
import { DEFAULT_IDLE_SECONDS, EXIT_COOLDOWN_SECONDS, SCREENSAVER_ENTITY } from './constants.js';
import { el, state } from './state.js';
import { log, toast } from './log.js';
import { mockHass, setScreensaverEntityState } from './mock.js';
import { currentConfig } from './config.js';

/** 屏保覆盖层是否已挂载（mountScreensaver 创建的 #snoozepanel-root）。 */
export function screensaverActive() {
  return document.getElementById('snoozepanel-root') !== null;
}

/**
 * 按给定配置挂载（或重挂）运行时元素（单例：重复调用先卸载旧实例）。
 * @param {SnoozeConfig} config
 * @param {boolean} [quiet] 静默模式（不弹「已挂载」Toast，由调用方自己反馈）
 * @returns {boolean} 是否成功挂载
 */
function mountRuntime(config, quiet = false) {
  if (!state.bundleReady) {
    toast('warning', '产物未加载', '请先在项目根执行 pnpm build，并重新加载产物。');
    return false;
  }
  if (!customElements.get('snooze-panel')) {
    log('error', 'snooze-panel 自定义元素未注册（产物异常）');
    toast('error', '运行时未注册', 'snooze-panel 元素不存在，请重新构建产物。');
    return false;
  }
  if (state.panelEl) state.panelEl.remove();
  // 干净起点：确保实体为 off，避免重挂瞬间被 syncFromEntity 立即激活
  setScreensaverEntityState('off');
  const element = /** @type {import('./types.js').PanelElementLike} */ (document.createElement('snooze-panel'));
  element.setConfig({ snoozepanel: config });
  element.hass = mockHass;
  document.body.appendChild(element);
  state.panelEl = element;
  state.mountedIdleSeconds = typeof config.idle_seconds === 'number' ? config.idle_seconds : DEFAULT_IDLE_SECONDS;
  state.lastInputAt = Date.now();
  log('ok', 'snooze-panel 已挂载（idle ' + state.mountedIdleSeconds + 's，触发实体 ' + SCREENSAVER_ENTITY + '）');
  if (!quiet) {
    toast('success', '运行时已挂载', '待机 ' + state.mountedIdleSeconds + ' 秒自动进入；也可直接点「触发屏保」。');
  }
  updateRuntimeStatus();
  return true;
}

/** 挂载按钮：按编辑器当前配置挂载。 */
export function handleMountClick() {
  const config = currentConfig();
  if (!mountRuntime(config)) return;
  state.appliedSnapshot = config;
  updateDirtyBadge();
}

/** 重新应用配置：按编辑器当前配置卸载重挂（保留编辑器实例，配置来源不变）。 */
export function handleReapplyClick() {
  if (!state.panelEl) {
    toast('warning', '运行时未挂载', '请先点击「挂载运行时」。');
    return;
  }
  const config = currentConfig();
  if (!mountRuntime(config, true)) return;
  state.appliedSnapshot = config;
  updateDirtyBadge();
  log('ok', '配置已重新应用（来源：编辑器当前配置）');
  toast('success', '配置已重新应用', '已按编辑器当前配置重挂运行时。');
}

/** 触发屏保：mock 实体置 on + 重新赋值 hass（生产同款 syncFromEntity 通路）。 */
export function handleTriggerClick() {
  if (!state.panelEl) {
    toast('warning', '运行时未挂载', '请先点击「挂载运行时」。');
    return;
  }
  if (screensaverActive()) {
    toast('warning', '屏保已在运行');
    return;
  }
  setScreensaverEntityState('on');
  state.panelEl.hass = mockHass; // setter → controller.setHass → syncFromEntity → activate()
  log('ok', '触发屏保：screensaver_entity → on（重赋 hass，走生产同步通路）');
  toast('success', '屏保已触发');
  window.setTimeout(updateRuntimeStatus, 50);
}

/** 退出屏保：mock 实体置 off + 重新赋值 hass。 */
export function handleExitClick() {
  if (!state.panelEl || !screensaverActive()) {
    toast('warning', '屏保当前未运行');
    return;
  }
  setScreensaverEntityState('off');
  state.panelEl.hass = mockHass;
  log('ok', '退出屏保：screensaver_entity → off（重赋 hass）');
  window.setTimeout(updateRuntimeStatus, 50);
}

/** 卸载运行时：el.remove() → disconnectedCallback → teardown（控制器与监听器销毁）。 */
export function handleUnmountClick() {
  if (!state.panelEl) {
    toast('warning', '运行时未挂载');
    return;
  }
  state.panelEl.remove();
  state.panelEl = null;
  setScreensaverEntityState('off');
  log('warn', '运行时已卸载（元素移除，控制器与事件监听已销毁）');
  toast('warning', '运行时已卸载', '屏保覆盖层与事件监听已清理。');
  updateRuntimeStatus();
}

/** 更新运行时状态徽标（未挂载 / 屏保中 / 冷却中 / 待机倒计时），并顺带刷新「未应用变更」徽标。 */
export function updateRuntimeStatus() {
  const active = screensaverActive();
  if (active !== state.lastActiveState) {
    if (active) {
      log('ok', '屏保已进入（全屏覆盖层已挂载）');
    } else {
      log('info', '屏保已退出');
      state.exitedAt = Date.now();
    }
    state.lastActiveState = active;
  }
  // 按钮态无条件随状态刷新：挂载/卸载只改变 panelEl，不改变激活态，
  // 若仅在激活态跃迁时刷新会漏掉这两个关键路径。
  updateActionButtons();
  updateDirtyBadge();
  let text = '未挂载';
  let cls = 'badge';
  if (state.panelEl) {
    if (active) {
      text = '屏保中';
      cls = 'badge accent';
    } else if (Date.now() < state.exitedAt + EXIT_COOLDOWN_SECONDS * 1000) {
      const remain = Math.ceil((state.exitedAt + EXIT_COOLDOWN_SECONDS * 1000 - Date.now()) / 1000);
      text = '冷却中 ' + remain + 's';
      cls = 'badge warn';
    } else {
      const remain = Math.max(0, Math.ceil((state.lastInputAt + state.mountedIdleSeconds * 1000 - Date.now()) / 1000));
      text = remain > 0 ? '待机倒计时 ' + remain + 's' : '即将触发…';
      cls = 'badge ok';
    }
  }
  if (el.badgeRuntime.textContent !== text) {
    el.badgeRuntime.textContent = text;
    el.badgeRuntime.className = cls;
  }
  // 顶栏收起态的运行时徽章与主徽章保持一致
  el.badgeRuntimeSlim.textContent = text;
  el.badgeRuntimeSlim.className = cls;
}

/** 根据运行时状态刷新按钮可用性。 */
export function updateActionButtons() {
  const active = screensaverActive();
  el.btnMount.disabled = !state.bundleReady || state.panelEl !== null;
  el.btnReapply.disabled = !state.bundleReady || state.panelEl === null;
  el.btnTrigger.disabled = state.panelEl === null || active;
  el.btnExit.disabled = state.panelEl === null || !active;
  el.btnUnmount.disabled = state.panelEl === null;
}

/** 刷新「未应用变更」徽标：编辑器当前配置与最近一次应用快照不一致即为已变更。 */
export function updateDirtyBadge() {
  if (!state.editorHandle || state.appliedSnapshot === null) {
    el.badgeDirty.textContent = '配置同步中…';
    el.badgeDirty.className = 'badge';
    return;
  }
  const dirty = JSON.stringify(state.editorHandle.getConfig()) !== JSON.stringify(state.appliedSnapshot);
  el.badgeDirty.textContent = dirty ? '有未应用变更' : '配置已同步';
  el.badgeDirty.className = dirty ? 'badge warn' : 'badge ok';
}
