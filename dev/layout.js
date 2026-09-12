// @ts-check
/**
 * dev 实测台自身的页面 UI 布局偏好（顶栏收起 / 底栏高度·收起）。
 *
 * 仅 UI 偏好，不涉及插件配置；持久化到 localStorage（异常/缺失/损坏一律回默认）。
 */
import { DEV_LAYOUT_KEY, BOTTOM_MIN, BOTTOM_DEFAULT } from './constants.js';
import { el } from './state.js';
import { log } from './log.js';

/** 实测台 UI 偏好（仅 UI，不涉及插件配置） */
/** @type {{ topCollapsed: boolean, bottomH: number, bottomCollapsed: boolean }} */
const devLayout = { topCollapsed: false, bottomH: BOTTOM_DEFAULT, bottomCollapsed: false };

/** 底栏最大高度：取视口 65% 与最小高度的大者 */
function bottomMaxHeight() {
  return Math.max(BOTTOM_MIN, Math.round(window.innerHeight * 0.65));
}

/**
 * 裁剪底栏高度到合法区间。
 * @param {number} h
 * @returns {number}
 */
function clampBottomH(h) {
  const n = Number(h);
  if (!Number.isFinite(n)) return BOTTOM_DEFAULT;
  return Math.min(bottomMaxHeight(), Math.max(BOTTOM_MIN, Math.round(n)));
}

/** 读取本地 UI 偏好（异常/缺失/损坏一律回默认，不影响实测台使用） */
export function loadDevLayout() {
  try {
    const raw = window.localStorage.getItem(DEV_LAYOUT_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return;
    devLayout.topCollapsed = parsed.topCollapsed === true;
    devLayout.bottomCollapsed = parsed.bottomCollapsed === true;
    devLayout.bottomH = clampBottomH(parsed.bottomH);
  } catch {
    // 隐私模式 / 数据损坏：忽略，保持默认
  }
}

/** 持久化 UI 偏好 */
function saveDevLayout() {
  try {
    window.localStorage.setItem(DEV_LAYOUT_KEY, JSON.stringify(devLayout));
  } catch {
    // 配额不足等：忽略
  }
}

/** 将 UI 偏好应用到 DOM（bootstrap 最先调用，防闪跳） */
export function applyDevLayout() {
  el.topbar.classList.toggle('slim', devLayout.topCollapsed);
  el.bottombar.classList.toggle('collapsed', devLayout.bottomCollapsed);
  document.documentElement.style.setProperty('--bottombar-h', clampBottomH(devLayout.bottomH) + 'px');
}

/**
 * 收起 / 展开顶栏。
 * @param {boolean} collapsed
 */
export function setTopCollapsed(collapsed) {
  devLayout.topCollapsed = collapsed;
  el.topbar.classList.toggle('slim', collapsed);
  saveDevLayout();
  log('info', collapsed ? '已收起顶栏（点击「展开顶栏」恢复）' : '已展开顶栏');
}

/**
 * 收起 / 展开底栏。
 * @param {boolean} collapsed
 */
export function setBottomCollapsed(collapsed) {
  devLayout.bottomCollapsed = collapsed;
  el.bottombar.classList.toggle('collapsed', collapsed);
  saveDevLayout();
  log('info', collapsed ? '已收起底栏（点击「展开」恢复）' : '已展开底栏');
}

/** 恢复底栏默认高度并展开 */
export function restoreBottomHeight() {
  devLayout.bottomCollapsed = false;
  devLayout.bottomH = BOTTOM_DEFAULT;
  el.bottombar.classList.remove('collapsed');
  document.documentElement.style.setProperty('--bottombar-h', BOTTOM_DEFAULT + 'px');
  saveDevLayout();
  log('info', '底栏高度已恢复默认（' + BOTTOM_DEFAULT + 'px）');
}

/**
 * 底栏向上拖高（pointer capture + 全局 sp-dev-resizing 类）。
 * @param {PointerEvent} ev
 */
export function startBottomResize(ev) {
  if (ev.button !== 0) return;
  ev.preventDefault();
  if (devLayout.bottomCollapsed) setBottomCollapsed(false);
  const startY = ev.clientY;
  const startH = clampBottomH(devLayout.bottomH);

  /** @param {PointerEvent} e */
  const onMove = (e) => {
    // 向上拖（clientY 减小）→ 高度增大
    devLayout.bottomH = clampBottomH(startH + (startY - e.clientY));
    document.documentElement.style.setProperty('--bottombar-h', devLayout.bottomH + 'px');
  };
  const onUp = () => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);
    document.documentElement.classList.remove('sp-dev-resizing');
    saveDevLayout();
    log('info', '底栏高度：' + devLayout.bottomH + 'px');
  };

  document.documentElement.classList.add('sp-dev-resizing');
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);
}

/** 窗口尺寸变化时重新裁剪底栏高度（避免超过新视口 65%） */
export function onWindowResize() {
  const clamped = clampBottomH(devLayout.bottomH);
  if (clamped !== devLayout.bottomH) {
    devLayout.bottomH = clamped;
    document.documentElement.style.setProperty('--bottombar-h', clamped + 'px');
    saveDevLayout();
  }
}
