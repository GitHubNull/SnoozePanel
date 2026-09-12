// @ts-check
/**
 * SnoozePanel 本地实测台逻辑（静态服务器直开，无构建步骤）。
 *
 * 设计约束：
 *   - 仅消费构建产物暴露的 window.SnoozePanelTestApi（只读、无副作用），
 *     跨 IIFE 边界获取表盘清单与实时预览；
 *   - 触发 / 退出走生产同款 screensaver_entity 通路
 *     （mock input_boolean 置位 + 重新赋值 el.hass → controller.syncFromEntity）；
 *   - 配置编辑器直接内嵌真实产物（mountEditor），与 HA 环境完全一致；
 *   - 所有操作走 Toast + 分级日志，全局异常（error / unhandledrejection）也纳入日志，
 *     保证「控制台零报错」可自证；
 *   - 本文件由 tsconfig.dev.json（allowJs + checkJs）做类型检查，JSDoc 与 src 侧类型对齐。
 */

/* ============================ 类型定义 ============================ */

/**
 * 日志级别。
 * @typedef {'info' | 'ok' | 'warn' | 'error'} LogLevel
 */

/**
 * 表盘纯数据摘要（与 src/ui/faces/registry.ts 的 FaceOption 对齐）。
 * @typedef {Object} FaceOption
 * @property {string} id
 * @property {string} label
 * @property {'digital' | 'analog'} kind
 * @property {'builtin' | 'thirdparty'} source
 */

/**
 * 表盘预览参数（与 src/runtime/preview.ts 的 FacePreviewOptions 对齐）。
 * @typedef {Object} FacePreviewOptions
 * @property {'midnight' | 'paper'} [theme]
 * @property {boolean} [seconds]
 * @property {boolean} [hour24]
 * @property {boolean} [showBackground]
 */

/**
 * 表盘预览句柄（与 src/runtime/preview.ts 的 FacePreviewHandle 对齐）。
 * @typedef {Object} FacePreviewHandle
 * @property {(faceId: string, opts?: FacePreviewOptions) => void} update
 * @property {() => void} destroy
 */

/**
 * 完整屏保预览参数（与 src/runtime/preview.ts 的 ScreensaverPreviewOptions 对齐）。
 * @typedef {Object} ScreensaverPreviewOptions
 * @property {string} [deviceId]
 */

/**
 * 完整屏保预览句柄（与 src/runtime/preview.ts 的 ScreensaverPreviewHandle 对齐）。
 * @typedef {Object} ScreensaverPreviewHandle
 * @property {(config: SnoozeConfig) => void} update
 * @property {() => void} destroy
 */

/**
 * SnoozeConfig（与 src/core/types.ts 对齐，dev 页仅作透传）。
 * @typedef {Record<string, unknown>} SnoozeConfig
 */

/**
 * 编辑器挂载句柄（与 src/main.ts 的 EditorHandle 对齐）。
 * @typedef {Object} EditorHandle
 * @property {() => SnoozeConfig} getConfig
 * @property {() => void} destroy
 */

/**
 * 产物暴露的实测支撑 API（与 src/main.ts 的 SnoozePanelTestApi 对齐）。
 * @typedef {Object} TestApi
 * @property {() => FaceOption[]} listFaces
 * @property {(host: HTMLElement, faceId: string, opts?: FacePreviewOptions) => FacePreviewHandle} mountFacePreview
 * @property {(host: HTMLElement, config: SnoozeConfig, hass: MockHass, opts?: ScreensaverPreviewOptions) => ScreensaverPreviewHandle} mountScreensaverPreview
 * @property {(host: HTMLElement, config: SnoozeConfig, hass: MockHass) => EditorHandle} mountEditor
 */

/**
 * mock hass 实体状态（与 src/core/hass.ts 的 HassEntityState 对齐）。
 * @typedef {Object} MockEntityState
 * @property {string} entity_id
 * @property {string} state
 * @property {Record<string, unknown>} attributes
 * @property {string} last_changed
 * @property {string} last_updated
 */

/**
 * mock hass（结构最小对齐 src/core/hass.ts 的 HassLike）。
 * @typedef {Object} MockHass
 * @property {Record<string, MockEntityState>} states
 * @property {{ name: string, is_admin: boolean }} user
 * @property {(domain: string, service: string, data?: Record<string, unknown>) => Promise<void>} callService
 * @property {(msg: Record<string, unknown>) => Promise<unknown>} callWS
 */

/**
 * snooze-panel / snooze-panel-editor 自定义元素的最小调用面。
 * @typedef {HTMLElement & {
 *   setConfig(config: Record<string, unknown>): void;
 *   hass: MockHass | null;
 * }} PanelElementLike
 */

/* ============================ 常量 ============================ */

/** 屏保强制实体（触发通路核心，配置内固定写入；与 mock hass 对齐） */
const SCREENSAVER_ENTITY = 'input_boolean.screensaver';
/** 退出冷却秒数（与运行时配置一致；用于状态徽标展示） */
const EXIT_COOLDOWN_SECONDS = 2;
/** 构建产物路径（相对 dev/ 页面；保留 ?t= 做缓存穿透） */
const BUNDLE_URL = '../tmp/dist/snoozepanel.js';
/** 日志条目上限（超出丢弃最旧条目，防止 DOM 无限膨胀） */
const LOG_LIMIT = 300;

/* ============================ 元素引用 ============================ */

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
const el = {
  idleChips: $id('idle-chips'),
  idleCustom: /** @type {HTMLInputElement} */ ($id('idle-custom')),
  btnMount: /** @type {HTMLButtonElement} */ ($id('btn-mount')),
  btnTrigger: /** @type {HTMLButtonElement} */ ($id('btn-trigger')),
  btnExit: /** @type {HTMLButtonElement} */ ($id('btn-exit')),
  btnUnmount: /** @type {HTMLButtonElement} */ ($id('btn-unmount')),
  badgeBundle: $id('badge-bundle'),
  badgeRuntime: $id('badge-runtime'),
  btnReloadBundle: /** @type {HTMLButtonElement} */ ($id('btn-reload-bundle')),
  btnEditorToggle: /** @type {HTMLButtonElement} */ ($id('btn-editor-toggle')),
  editorBody: $id('editor-body'),
  editorHost: $id('editor-host'),
  editorDirty: $id('editor-dirty'),
  previewCanvas: $id('preview-canvas'),
  btnReapply: /** @type {HTMLButtonElement} */ ($id('btn-reapply')),
  btnRefreshDevices: /** @type {HTMLButtonElement} */ ($id('btn-refresh-devices')),
  deviceList: /** @type {HTMLUListElement} */ ($id('device-list')),
  btnClearLog: /** @type {HTMLButtonElement} */ ($id('btn-clear-log')),
  logList: /** @type {HTMLUListElement} */ ($id('log')),
  toastStack: $id('toast-stack'),
};

/* ============================ 运行时状态 ============================ */

/** 产物是否已成功加载且暴露 API */
let bundleReady = false;
/** 实测支撑 API（产物加载后赋值） */
/** @type {TestApi | undefined} */
let api;

/** 当前挂载的 snooze-panel 元素（单例，避免重复挂载泄漏） */
/** @type {PanelElementLike | null} */
let panelEl = null;
/** 挂载时生效的闲置秒数（供倒计时展示，避免与后续 UI 修改混淆） */
let mountedIdleSeconds = 15;

/** 编辑器句柄（惰性创建）/ 未应用草稿 / 脏标记 */
/** @type {EditorHandle | null} */
let editorHandle = null;
/** 中间「阅览画布」完整屏保预览句柄 */
/** @type {ScreensaverPreviewHandle | null} */
let previewHandle = null;
/** @type {SnoozeConfig | null} */
let editorDraft = null;
let editorDirty = false;
/** @type {number | undefined} */
let editorDebounceTimer;

/** 待机倒计时基准：最近一次用户输入 / 挂载时刻 */
let lastInputAt = Date.now();
/** 屏保覆盖层上一次观测到的激活状态（用于进入/退出日志与冷却起点） */
let lastActiveState = false;
/** 屏保最近一次退出时间（用于冷却徽标） */
let exitedAt = 0;

/** mock 后端存储（内存对象，模拟 custom component 的 .storage/） */
/** @type {{ devices: Record<string, unknown> }} */
const mockStore = { devices: {} };

/* ============================ 日志 / Toast ============================ */

/**
 * 追加一条分级日志（自动滚动到底部；超上限丢弃最旧条目）。
 * @param {LogLevel} level
 * @param {string} message
 */
function log(level, message) {
  const li = document.createElement('li');
  li.className = 'log-line ' + level;
  const time = document.createElement('span');
  time.className = 'time';
  time.textContent = new Date().toLocaleTimeString('zh-CN', { hour12: false });
  const msg = document.createElement('span');
  msg.className = 'msg';
  msg.textContent = message;
  li.append(time, msg);
  el.logList.appendChild(li);
  if (el.logList.children.length > LOG_LIMIT) {
    const first = el.logList.firstElementChild;
    if (first) first.remove();
  }
  el.logList.scrollTop = el.logList.scrollHeight;
}

/**
 * 右上角轻提示（点击立即关闭；3.6s 自动消失）。
 * @param {'success' | 'error' | 'warning'} kind
 * @param {string} title
 * @param {string} [detail]
 */
function toast(kind, title, detail) {
  const box = document.createElement('div');
  box.className = 'toast ' + kind;
  const titleEl = document.createElement('div');
  titleEl.className = 'toast-title';
  titleEl.textContent = title;
  box.appendChild(titleEl);
  if (detail) {
    const detailEl = document.createElement('div');
    detailEl.className = 'toast-detail';
    detailEl.textContent = detail;
    box.appendChild(detailEl);
  }
  box.addEventListener('click', () => box.remove());
  el.toastStack.appendChild(box);
  window.setTimeout(() => {
    box.classList.add('leave');
    window.setTimeout(() => box.remove(), 240);
  }, 3600);
}

/* ============================ mock hass / mock 后端 ============================ */

/**
 * 修改 mock 屏保实体状态。
 * @param {'on' | 'off'} state
 * @param {boolean} [silent] 静默模式（callService 回写时不重复记日志）
 */
function setScreensaverEntityState(state, silent = false) {
  const st = mockHass.states[SCREENSAVER_ENTITY];
  if (!st) return;
  const changed = st.state !== state;
  st.state = state;
  if (!silent && changed) log('info', 'mock 实体 ' + SCREENSAVER_ENTITY + ' → ' + state);
}

/** mock hass：实体 / 用户 / 服务调用 / WS 后端读写（仅内存，无外发请求） */
/** @type {MockHass} */
const mockHass = {
  states: {
    'weather.home': {
      entity_id: 'weather.home',
      state: 'sunny',
      attributes: { temperature: 26, humidity: 45 },
      last_changed: '',
      last_updated: '',
    },
    'sensor.temp': {
      entity_id: 'sensor.temp',
      state: '23.5',
      attributes: {},
      last_changed: '',
      last_updated: '',
    },
    'binary_sensor.someone_home': {
      entity_id: 'binary_sensor.someone_home',
      state: 'on',
      attributes: {},
      last_changed: '',
      last_updated: '',
    },
    'sun.sun': {
      entity_id: 'sun.sun',
      state: 'above_horizon',
      attributes: { next_rising: '2026-09-12T06:00:00+08:00', next_setting: '2026-09-11T18:30:00+08:00' },
      last_changed: '',
      last_updated: '',
    },
    [SCREENSAVER_ENTITY]: {
      entity_id: SCREENSAVER_ENTITY,
      state: 'off',
      attributes: {},
      last_changed: '',
      last_updated: '',
    },
  },
  user: { name: 'admin', is_admin: true },
  async callService(domain, service, data) {
    const entityId = data && typeof data.entity_id === 'string' ? data.entity_id : '';
    if (entityId === SCREENSAVER_ENTITY) {
      // 控制器进入/退出屏保时同步实体状态，避免 syncFromEntity 反复触发
      setScreensaverEntityState(service === 'turn_on' ? 'on' : 'off', true);
      log('info', 'mock callService ' + domain + '.' + service + ' → ' + entityId + '（实体状态已同步）');
    } else {
      log('info', 'mock callService ' + domain + '.' + service);
    }
  },
  async callWS(msg) {
    const type = String(msg.type);
    if (type === 'snoozepanel/get_config') {
      const deviceId = String(msg.device_id);
      const config = mockStore.devices[deviceId] ?? null;
      log('info', 'mock WS get_config → ' + deviceId + (config ? '（命中覆盖）' : '（无覆盖）'));
      return { config };
    }
    if (type === 'snoozepanel/set_config') {
      const deviceId = String(msg.device_id);
      mockStore.devices[deviceId] = msg.config;
      log('ok', 'mock WS set_config → 已落盘设备 ' + deviceId);
      toast('success', '已保存到 mock 后端', '设备 id：' + deviceId);
      void refreshDeviceList();
      return { success: true };
    }
    if (type === 'snoozepanel/list_devices') {
      const ids = Object.keys(mockStore.devices);
      log('info', 'mock WS list_devices → ' + ids.length + ' 台已保存');
      return { devices: ids };
    }
    if (type === 'snoozepanel/delete_config') {
      const deviceId = String(msg.device_id);
      const had = deviceId in mockStore.devices;
      delete mockStore.devices[deviceId];
      log('warn', 'mock WS delete_config → ' + deviceId + (had ? ' 已删除' : ' 不存在'));
      return { success: had };
    }
    log('error', 'mock WS 收到未知命令：' + type);
    throw new Error('未知 WS 命令: ' + type);
  },
};

/* ============================ 构建产物加载 ============================ */

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

/** 加载（或重试加载）构建产物并初始化编辑器。 */
async function loadBundle() {
  setBundleBadge('loading');
  el.btnReloadBundle.hidden = true;
  const ok = await loadBundleScript();
  if (!ok) {
    bundleReady = false;
    setBundleBadge('error');
    el.btnReloadBundle.hidden = false;
    log('error', '产物加载失败：' + BUNDLE_URL + ' 不存在（请先在项目根执行 pnpm build）');
    toast('error', '未找到构建产物', '请先在项目根执行 pnpm build，再点击「重新加载产物」。');
    updateActionButtons();
    return;
  }
  api = readTestApi();
  if (!api) {
    bundleReady = false;
    setBundleBadge('error');
    log('error', '产物已加载，但未暴露 window.SnoozePanelTestApi（产物版本不匹配？）');
    toast('error', '产物版本不匹配', '未检测到 window.SnoozePanelTestApi，请重新执行 pnpm build。');
    updateActionButtons();
    return;
  }
  bundleReady = true;
  setBundleBadge('ok');
  log('ok', '构建产物已加载并暴露 SnoozePanelTestApi');
  updateActionButtons();
}

/* ============================ 配置构建 ============================ */

/**
 * 约束闲置秒数在 5–3600（与 core/config.ts normalizeConfig 一致）。
 * @param {number} value
 * @returns {number}
 */
function clampIdle(value) {
  if (!Number.isFinite(value)) return 15;
  return Math.min(3600, Math.max(5, Math.round(value)));
}

/** 组装基础运行时配置（控制面板当前选项 + 固定 screensaver_entity 触发通路）。 */
function buildBaseConfig() {
  const idleSeconds = clampIdle(Number(el.idleCustom.value));
  return {
    enabled: true,
    idle_seconds: idleSeconds,
    exit_cooldown_seconds: EXIT_COOLDOWN_SECONDS,
    theme: 'midnight',
    screensaver_entity: SCREENSAVER_ENTITY,
    components: {
      clock: { show: true, style: 'digital', hour24: true, seconds: true, layout: { x: 50, y: 40, w: 55 } },
      calendar: { show: true, week_start: 1, show_week_number: true, format: 'M月D日 dddd', layout: { x: 50, y: 72, w: 32 } },
      lunar: { show: true, format: '{lunar_month}{lunar_day} {ganzhi}{zodiac}年', layout: { x: 50, y: 93, w: 30 } },
      weather: { show: true, entity: 'weather.home', layout: { x: 82, y: 12, w: 28 } },
      texts: [{ content: '室温 {sensor.temp}°C', layout: { x: 16, y: 12, w: 30 } }],
    },
    background: {
      type: 'color', color: '#0b1020',
      gradient: { from: '#0b1020', to: '#1b2a4a', angle: 160 },
      images: [], interval_seconds: 30, dim: 0.45,
    },
  };
}

/* ============================ 运行时挂载 / 触发 / 退出 ============================ */

/** 屏保覆盖层是否已挂载（mountScreensaver 创建的 #snoozepanel-root）。 */
function screensaverActive() {
  return document.getElementById('snoozepanel-root') !== null;
}

/**
 * 按给定配置挂载（或重挂）运行时元素（单例：重复调用先卸载旧实例）。
 * @param {Record<string, unknown>} config
 * @param {boolean} [quiet] 静默模式（不弹「已挂载」Toast，由调用方自己反馈）
 * @returns {boolean} 是否成功挂载
 */
function mountRuntime(config, quiet = false) {
  if (!bundleReady) {
    toast('warning', '产物未加载', '请先在项目根执行 pnpm build，并重新加载产物。');
    return false;
  }
  if (!customElements.get('snooze-panel')) {
    log('error', 'snooze-panel 自定义元素未注册（产物异常）');
    toast('error', '运行时未注册', 'snooze-panel 元素不存在，请重新构建产物。');
    return false;
  }
  if (panelEl) panelEl.remove();
  // 干净起点：确保实体为 off，避免重挂瞬间被 syncFromEntity 立即激活
  setScreensaverEntityState('off');
  const element = /** @type {PanelElementLike} */ (document.createElement('snooze-panel'));
  element.setConfig({ snoozepanel: config });
  element.hass = mockHass;
  document.body.appendChild(element);
  panelEl = element;
  mountedIdleSeconds = typeof config.idle_seconds === 'number' ? config.idle_seconds : clampIdle(Number(el.idleCustom.value));
  lastInputAt = Date.now();
  log('ok', 'snooze-panel 已挂载（idle ' + mountedIdleSeconds + 's，触发实体 ' + SCREENSAVER_ENTITY + '）');
  if (!quiet) {
    toast('success', '运行时已挂载', '待机 ' + mountedIdleSeconds + ' 秒自动进入；也可直接点「触发屏保」。');
  }
  updateRuntimeStatus();
  return true;
}

/** 挂载按钮：按控制面板选项组装配置并挂载。 */
function handleMountClick() {
  mountRuntime(buildBaseConfig());
}

/** 触发屏保：mock 实体置 on + 重新赋值 hass（生产同款 syncFromEntity 通路）。 */
function handleTriggerClick() {
  if (!panelEl) {
    toast('warning', '运行时未挂载', '请先点击「挂载运行时」。');
    return;
  }
  if (screensaverActive()) {
    toast('warning', '屏保已在运行');
    return;
  }
  setScreensaverEntityState('on');
  panelEl.hass = mockHass; // setter → controller.setHass → syncFromEntity → activate()
  log('ok', '触发屏保：screensaver_entity → on（重赋 hass，走生产同步通路）');
  toast('success', '屏保已触发');
  window.setTimeout(updateRuntimeStatus, 50);
}

/** 退出屏保：mock 实体置 off + 重新赋值 hass。 */
function handleExitClick() {
  if (!panelEl || !screensaverActive()) {
    toast('warning', '屏保当前未运行');
    return;
  }
  setScreensaverEntityState('off');
  panelEl.hass = mockHass;
  log('ok', '退出屏保：screensaver_entity → off（重赋 hass）');
  window.setTimeout(updateRuntimeStatus, 50);
}

/** 卸载运行时：el.remove() → disconnectedCallback → teardown（控制器与监听器销毁）。 */
function handleUnmountClick() {
  if (!panelEl) {
    toast('warning', '运行时未挂载');
    return;
  }
  panelEl.remove();
  panelEl = null;
  setScreensaverEntityState('off');
  log('warn', '运行时已卸载（元素移除，控制器与事件监听已销毁）');
  toast('warning', '运行时已卸载', '屏保覆盖层与事件监听已清理。');
  updateRuntimeStatus();
}

/* ============================ 状态徽标与按钮态 ============================ */

/** 更新运行时状态徽标（未挂载 / 屏保中 / 冷却中 / 待机倒计时）。 */
function updateRuntimeStatus() {
  const active = screensaverActive();
  if (active !== lastActiveState) {
    if (active) {
      log('ok', '屏保已进入（全屏覆盖层已挂载）');
    } else {
      log('info', '屏保已退出');
      exitedAt = Date.now();
    }
    lastActiveState = active;
  }
  // 按钮态无条件随状态刷新：挂载/卸载只改变 panelEl，不改变激活态，
  // 若仅在激活态跃迁时刷新会漏掉这两个关键路径。
  updateActionButtons();
  let text = '未挂载';
  let cls = 'badge';
  if (panelEl) {
    if (active) {
      text = '屏保中';
      cls = 'badge accent';
    } else if (Date.now() < exitedAt + EXIT_COOLDOWN_SECONDS * 1000) {
      const remain = Math.ceil((exitedAt + EXIT_COOLDOWN_SECONDS * 1000 - Date.now()) / 1000);
      text = '冷却中 ' + remain + 's';
      cls = 'badge warn';
    } else {
      const remain = Math.max(0, Math.ceil((lastInputAt + mountedIdleSeconds * 1000 - Date.now()) / 1000));
      text = remain > 0 ? '待机倒计时 ' + remain + 's' : '即将触发…';
      cls = 'badge ok';
    }
  }
  if (el.badgeRuntime.textContent !== text) {
    el.badgeRuntime.textContent = text;
    el.badgeRuntime.className = cls;
  }
}

/** 根据运行时状态刷新按钮可用性与 loading 态。 */
function updateActionButtons() {
  const active = screensaverActive();
  el.btnMount.disabled = !bundleReady || panelEl !== null;
  el.btnTrigger.disabled = panelEl === null || active;
  el.btnExit.disabled = panelEl === null || !active;
  el.btnUnmount.disabled = panelEl === null;
  el.btnReapply.disabled = !bundleReady;
}

/**
 * 切换按钮 loading 态（禁用 + 旋转指示）。
 * @param {HTMLButtonElement} btn
 * @param {boolean} busy
 */
function setBusy(btn, busy) {
  if (busy) {
    btn.dataset.busy = '1';
    btn.disabled = true;
  } else {
    delete btn.dataset.busy;
    btn.disabled = false;
  }
}

/* ============================ 配置编辑器集成（内嵌真实产物） ============================ */

/** 切换编辑器折叠态（首次展开时惰性创建编辑器）。 */
function toggleEditor() {
  const willOpen = el.editorBody.hidden;
  el.editorBody.hidden = !willOpen;
  el.btnEditorToggle.textContent = willOpen ? '收起' : '展开';
  el.btnEditorToggle.setAttribute('aria-expanded', String(willOpen));
  if (willOpen) {
    ensureEditor();
    el.editorBody.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

/** 惰性创建编辑器（一次），并启动草稿轮询检测变更。 */
function ensureEditor() {
  if (editorHandle) return;
  if (!api) {
    log('error', '产物未加载，无法创建编辑器');
    toast('error', '编辑器不可用', '请先加载构建产物。');
    return;
  }
  editorHandle = api.mountEditor(el.editorHost, buildBaseConfig(), mockHass);
  log('ok', '配置编辑器已创建（内嵌真实产物，与 HA 环境一致）');

  // 轮询检测草稿变更（编辑器内部 emit 防抖 300ms，轮询 500ms 足够及时）
  window.setInterval(() => {
    if (!editorHandle) return;
    const current = editorHandle.getConfig();
    if (JSON.stringify(current) !== JSON.stringify(editorDraft)) {
      if (editorDebounceTimer !== undefined) window.clearTimeout(editorDebounceTimer);
      editorDebounceTimer = window.setTimeout(() => {
        editorDraft = current;
        syncPreview(current);
        if (!editorDirty) {
          editorDirty = true;
          el.editorDirty.hidden = false;
          log('info', '编辑器草稿已变更（标记「有未应用变更」）');
        }
      }, 400);
    }
  }, 500);
}

/** 初始化中间「阅览画布」（完整屏保预览，编辑态）。 */
function initPreview() {
  if (!api || previewHandle) return;
  previewHandle = api.mountScreensaverPreview(el.previewCanvas, buildBaseConfig(), mockHass, { deviceId: 'dev-preview' });
  log('ok', '阅览画布已挂载（完整屏保预览，编辑态）');
}

/**
 * 热更新阅览画布配置（随控制面板 / 编辑器草稿变化实时刷新）。
 * @param {SnoozeConfig} config
 */
function syncPreview(config) {
  if (previewHandle) previewHandle.update(config);
}

/** 重新应用配置：卸载 + 按最新配置重挂（优先编辑器草稿，其次控制面板）。 */
function reapplyConfig() {
  const useDraft = editorDirty && editorDraft !== null;
  const config = useDraft && editorDraft ? editorDraft : buildBaseConfig();
  const ok = mountRuntime(config, true);
  if (!ok) return;
  syncPreview(config);
  if (useDraft) {
    editorDirty = false;
    editorDraft = null;
    el.editorDirty.hidden = true;
  }
  const source = useDraft ? '编辑器草稿' : '控制面板当前选项';
  log('ok', '配置已重新应用（来源：' + source + '）');
  toast('success', '配置已重新应用', '来源：' + source);
}

/* ============================ mock 后端设备列表 ============================ */

/** 拉取并渲染 mock 后端已保存设备。 */
async function refreshDeviceList() {
  try {
    const res = /** @type {{ devices?: string[] }} */ (await mockHass.callWS({ type: 'snoozepanel/list_devices' }));
    renderDeviceList(res.devices ?? []);
  } catch (err) {
    log('error', '设备列表刷新失败：' + String(err));
  }
}

/**
 * 渲染设备列表（每项含删除按钮）。
 * @param {string[]} ids
 */
function renderDeviceList(ids) {
  el.deviceList.innerHTML = '';
  if (ids.length === 0) {
    const li = document.createElement('li');
    li.className = 'dim';
    li.textContent = '尚未保存任何设备';
    el.deviceList.appendChild(li);
    return;
  }
  for (const id of ids) {
    const li = document.createElement('li');
    const code = document.createElement('code');
    code.textContent = id;
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'btn ghost tiny';
    del.textContent = '删除';
    del.addEventListener('click', () => { void deleteDevice(id); });
    li.append(code, del);
    el.deviceList.appendChild(li);
  }
}

/**
 * 删除某设备的后端配置。
 * @param {string} id
 */
async function deleteDevice(id) {
  try {
    await mockHass.callWS({ type: 'snoozepanel/delete_config', device_id: id });
    toast('warning', '已删除设备配置', id);
    await refreshDeviceList();
  } catch (err) {
    log('error', '删除设备配置失败：' + String(err));
  }
}

/* ============================ 事件绑定与启动 ============================ */

/** 绑定闲置时长档位与自定义输入（两者互相同步）。 */
function bindIdleControls() {
  for (const chip of el.idleChips.querySelectorAll('.chip-btn')) {
    if (!(chip instanceof HTMLElement)) continue;
    chip.addEventListener('click', () => {
      const value = Number(chip.dataset.idle);
      if (!Number.isFinite(value)) return;
      el.idleCustom.value = String(value);
      syncIdleChips();
      log('info', '闲置时长设为 ' + value + ' 秒（下次挂载生效）');
    });
  }
  el.idleCustom.addEventListener('change', () => {
    el.idleCustom.value = String(clampIdle(Number(el.idleCustom.value)));
    syncIdleChips();
  });
}

/** 按自定义输入值高亮匹配的档位按钮。 */
function syncIdleChips() {
  const value = el.idleCustom.value;
  for (const chip of el.idleChips.querySelectorAll('.chip-btn')) {
    if (!(chip instanceof HTMLElement)) continue;
    chip.classList.toggle('active', chip.dataset.idle === value);
  }
}

/** 注册所有事件监听（含全局异常入日志）。 */
function bindEvents() {
  el.btnMount.addEventListener('click', handleMountClick);
  el.btnTrigger.addEventListener('click', handleTriggerClick);
  el.btnExit.addEventListener('click', handleExitClick);
  el.btnUnmount.addEventListener('click', handleUnmountClick);
  el.btnReloadBundle.addEventListener('click', () => {
    setBusy(el.btnReloadBundle, true);
    void loadBundle().finally(() => setBusy(el.btnReloadBundle, false));
  });
  bindIdleControls();
  el.btnEditorToggle.addEventListener('click', toggleEditor);
  el.btnReapply.addEventListener('click', reapplyConfig);
  el.btnRefreshDevices.addEventListener('click', () => { void refreshDeviceList(); });
  el.btnClearLog.addEventListener('click', () => {
    el.logList.innerHTML = '';
    log('info', '日志已清空');
  });

  // 全局异常入日志：确保「控制台无报错」可自证
  window.addEventListener('error', (ev) => {
    log('error', 'window error：' + (ev.message || '未知错误') + (ev.filename ? ' @ ' + ev.filename + ':' + ev.lineno : ''));
  });
  window.addEventListener('unhandledrejection', (ev) => {
    log('error', 'unhandled rejection：' + String(ev.reason));
  });

  // 用户输入刷新待机倒计时基准（与控制器内部闲置计时近似对齐）
  const markInput = () => { lastInputAt = Date.now(); };
  window.addEventListener('pointerdown', markInput, { passive: true, capture: true });
  window.addEventListener('keydown', markInput, true);
}

/** 启动：初始禁用 → 加载产物 → 初始化设备列表 → 状态轮询。 */
async function bootstrap() {
  // PrimeVue 深色主题（编辑器内部组件跟随；与实测台整体风格一致）
  document.documentElement.classList.add('snooze-editor-dark');
  updateActionButtons();
  log('info', '本地实测台启动：mock hass + mock 后端已就绪');
  await loadBundle();
  initPreview();
  await refreshDeviceList();
  window.setInterval(updateRuntimeStatus, 250);
  updateRuntimeStatus();
}

bindEvents();
void bootstrap();
