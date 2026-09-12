// @ts-check
/**
 * dev 实测台共享状态：页面元素引用 + 可变运行时状态。
 *
 * - 页面元素引用在模块加载时解析一次（静态页面 id 拼错应尽早暴露）；
 * - 可变运行时状态统一收敛到单一 `state` 对象：ESM 导入绑定是只读的，
 *   跨模块直接 `let` 重赋值不会生效，故必须以对象属性承载可变字段。
 *
 * @typedef {import('./types.js').TestApi} TestApi
 * @typedef {import('./types.js').EditorHandle} EditorHandle
 * @typedef {import('./types.js').SnoozeConfig} SnoozeConfig
 * @typedef {import('./types.js').PanelElementLike} PanelElementLike
 */
import { DEFAULT_IDLE_SECONDS } from './constants.js';

/**
 * 按 id 取元素（静态页面中 id 拼错应尽早暴露）。
 * @param {string} id
 * @returns {HTMLElement}
 */
function $id(id) {
  const el = document.getElementById(id);
  if (!el) throw new Error('缺少元素 #' + id);
  return el;
}

/** 页面元素引用（模块加载时解析一次） */
export const el = {
  topbar: $id('topbar'),
  bottombar: $id('bottombar'),
  bottombarResizer: $id('bottombar-resizer'),
  btnMount: /** @type {HTMLButtonElement} */ ($id('btn-mount')),
  btnReapply: /** @type {HTMLButtonElement} */ ($id('btn-reapply')),
  btnTrigger: /** @type {HTMLButtonElement} */ ($id('btn-trigger')),
  btnExit: /** @type {HTMLButtonElement} */ ($id('btn-exit')),
  btnUnmount: /** @type {HTMLButtonElement} */ ($id('btn-unmount')),
  badgeBundle: $id('badge-bundle'),
  badgeDirty: $id('badge-dirty'),
  badgeRuntime: $id('badge-runtime'),
  badgeRuntimeSlim: $id('badge-runtime-slim'),
  btnReloadBundle: /** @type {HTMLButtonElement} */ ($id('btn-reload-bundle')),
  stageBoard: $id('stage-board'),
  btnTopCollapse: /** @type {HTMLButtonElement} */ ($id('btn-top-collapse')),
  btnTopExpand: /** @type {HTMLButtonElement} */ ($id('btn-top-expand')),
  btnBottomCollapse: /** @type {HTMLButtonElement} */ ($id('btn-bottom-collapse')),
  btnBottomExpand: /** @type {HTMLButtonElement} */ ($id('btn-bottom-expand')),
  btnRestoreBottom: /** @type {HTMLButtonElement} */ ($id('btn-restore-bottom')),
  btnRefreshDevices: /** @type {HTMLButtonElement} */ ($id('btn-refresh-devices')),
  deviceList: /** @type {HTMLUListElement} */ ($id('device-list')),
  btnRefreshPlugins: /** @type {HTMLButtonElement} */ ($id('btn-refresh-plugins')),
  pluginList: /** @type {HTMLUListElement} */ ($id('plugin-list')),
  btnClearLog: /** @type {HTMLButtonElement} */ ($id('btn-clear-log')),
  logList: /** @type {HTMLUListElement} */ ($id('log')),
  toastStack: $id('toast-stack'),
};

/**
 * 可变运行时状态（单一对象承载，跨模块以属性读写）。
 * @type {{
 *   bundleReady: boolean,
 *   api: TestApi | undefined,
 *   panelEl: PanelElementLike | null,
 *   mountedIdleSeconds: number,
 *   editorHandle: EditorHandle | null,
 *   appliedSnapshot: SnoozeConfig | null,
 *   lastInputAt: number,
 *   lastActiveState: boolean,
 *   exitedAt: number,
 * }}
 */
export const state = {
  /** 产物是否已成功加载且暴露 API */
  bundleReady: false,
  /** 实测支撑 API（产物加载后赋值） */
  api: undefined,
  /** 当前挂载的 snooze-panel 元素（单例，避免重复挂载泄漏） */
  panelEl: null,
  /** 挂载时生效的闲置秒数（供倒计时展示，避免与后续 UI 修改混淆） */
  mountedIdleSeconds: DEFAULT_IDLE_SECONDS,
  /** 内嵌编辑器句柄（主内容区常驻） */
  editorHandle: null,
  /** 最近一次「应用」（挂载 / 重新应用）所采用的配置快照，用于「有未应用变更」徽标比对 */
  appliedSnapshot: null,
  /** 待机倒计时基准：最近一次用户输入 / 挂载时刻 */
  lastInputAt: Date.now(),
  /** 屏保覆盖层上一次观测到的激活状态（用于进入/退出日志与冷却起点） */
  lastActiveState: false,
  /** 屏保最近一次退出时间（用于冷却徽标） */
  exitedAt: 0,
};
