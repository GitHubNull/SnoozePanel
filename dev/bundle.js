// @ts-check
/**
 * dev 实测台：构建产物（IIFE）的加载与状态徽标，以及 IIFE 跨边界暴露 API 的读取。
 *
 * @typedef {import('./types.js').TestApi} TestApi
 */
import { BUNDLE_URL } from './constants.js';
import { el, state } from './state.js';
import { log, toast } from './log.js';
import { updateActionButtons } from './runtime.js';

/** 读取产物暴露的实测支撑 API（IIFE 挂到 window 上）。 */
function readTestApi() {
  const w = /** @type {Window & { SnoozePanelTestApi?: TestApi }} */ (window);
  return w.SnoozePanelTestApi;
}

/**
 * 更新产物状态徽标。
 * @param {'loading' | 'ok' | 'error'} kind
 */
function setBundleBadge(kind) {
  if (kind === 'loading') {
    el.badgeBundle.textContent = '产物加载中…';
    el.badgeBundle.className = 'badge warn';
  } else if (kind === 'ok') {
    el.badgeBundle.textContent = '产物已加载';
    el.badgeBundle.className = 'badge ok';
  } else {
    el.badgeBundle.textContent = '产物加载失败';
    el.badgeBundle.className = 'badge error';
  }
}

/**
 * 动态注入构建产物脚本（IIFE，用 script 标签跨模块边界）。
 * @returns {Promise<boolean>} 是否加载成功
 */
function loadBundleScript() {
  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = BUNDLE_URL + '?t=' + Date.now();
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
}

/** 加载（或重试加载）构建产物并初始化内嵌编辑器。 */
export async function loadBundle() {
  setBundleBadge('loading');
  el.btnReloadBundle.hidden = true;
  const ok = await loadBundleScript();
  if (!ok) {
    state.bundleReady = false;
    setBundleBadge('error');
    el.btnReloadBundle.hidden = false;
    log('error', '产物加载失败：' + BUNDLE_URL + ' 不存在（请先在项目根执行 pnpm build）');
    toast('error', '未找到构建产物', '请先在项目根执行 pnpm build，再点击「重新加载产物」。');
    updateActionButtons();
    return;
  }
  state.api = readTestApi();
  if (!state.api) {
    state.bundleReady = false;
    setBundleBadge('error');
    log('error', '产物已加载，但未暴露 window.SnoozePanelTestApi（产物版本不匹配？）');
    toast('error', '产物版本不匹配', '未检测到 window.SnoozePanelTestApi，请重新执行 pnpm build。');
    updateActionButtons();
    return;
  }
  state.bundleReady = true;
  setBundleBadge('ok');
  log('ok', '构建产物已加载并暴露 SnoozePanelTestApi');
  updateActionButtons();
}
