// @ts-check
/**
 * SnoozePanel 本地实测台逻辑（静态服务器直开，无构建步骤）。
 *
 * 设计约束：
 *   - 仅消费构建产物暴露的 window.SnoozePanelTestApi（只读、无副作用），
 *     跨 IIFE 边界获取表盘清单与实时预览；
 *   - 触发 / 退出走生产同款 screensaver_entity 通路
 *     （mock input_boolean 置位 + 重新赋值 el.hass → controller.syncFromEntity）；
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
 * 产物暴露的实测支撑 API（与 src/main.ts 的 SnoozePanelTestApi 对齐）。
 * @typedef {Object} TestApi
 * @property {() => FaceOption[]} listFaces
 * @property {(host: HTMLElement, faceId: string, opts?: FacePreviewOptions) => FacePreviewHandle} mountFacePreview
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
  theme: /** @type {HTMLSelectElement} */ ($id('theme')),
  bgType: /** @type {HTMLSelectElement} */ ($id('bg-type')),
  idleChips: $id('idle-chips'),
  idleCustom: /** @type {HTMLInputElement} */ ($id('idle-custom')),
  btnMount: /** @type {HTMLButtonElement} */ ($id('btn-mount')),
  btnTrigger: /** @type {HTMLButtonElement} */ ($id('btn-trigger')),
  btnExit: /** @type {HTMLButtonElement} */ ($id('btn-exit')),
  btnUnmount: /** @type {HTMLButtonElement} */ ($id('btn-unmount')),
  badgeBundle: $id('badge-bundle'),
  badgeRuntime: $id('badge-runtime'),
  btnReloadBundle: /** @type {HTMLButtonElement} */ ($id('btn-reload-bundle')),
  faceTrigger: /** @type {HTMLButtonElement} */ ($id('face-trigger')),
  faceTriggerThumb: $id('face-trigger-thumb'),
  faceTriggerName: $id('face-trigger-name'),
  faceTriggerKind: $id('face-trigger-kind'),
  facePanel: $id('face-panel'),
  faceBig: $id('face-big'),
  btnEditorToggle: /** @type {HTMLButtonElement} */ ($id('btn-editor-toggle')),
  editorBody: $id('editor-body'),
  editorHost: $id('editor-host'),
  editorDirty: $id('editor-dirty'),
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

/** 表盘清单（来自产物 API） */
/** @type {FaceOption[]} */
let faces = [];
/** 当前选中表盘 id */
let currentFaceId = '';
/** 收起态迷你预览句柄 */
/** @type {FacePreviewHandle | null} */
let triggerPreview = null;
/** 大预览句柄 */
/** @type {FacePreviewHandle | null} */
let bigPreview = null;
/** 展开面板中的选项预览（面板关闭即全部销毁） */
/** @type {{ id: string, handle: FacePreviewHandle }[] } */
let optionPreviews = [];

/** 当前挂载的 snooze-panel 元素（单例，避免重复挂载泄漏） */
/** @type {PanelElementLike | null} */
let panelEl = null;
/** 挂载时生效的闲置秒数（供倒计时展示，避免与后续 UI 修改混淆） */
let mountedIdleSeconds = 15;

/** 编辑器元素（惰性创建）/ 未应用草稿 / 脏标记 */
/** @type {PanelElementLike | null} */
let editorEl = null;
/** @type {Record<string, unknown> | null} */
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

/** 加载（或重试加载）构建产物并初始化表盘能力。 */
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
  initFaces();
  updateActionButtons();
}

/* ============================ 表盘下拉（实时迷你预览） ============================ */

/** 当前预览参数（与运行时开关对齐：显示秒、24 小时制、绘制主题背景）。 */
function currentPreviewOptions() {
  const theme = /** @type {'midnight' | 'paper'} */ (el.theme.value === 'paper' ? 'paper' : 'midnight');
  return { theme, seconds: true, hour24: true, showBackground: true };
}

/** 大预览参数：在迷你预览基础上放大 zoom 倍，让表盘在较大容器里清晰可读（边缘裁剪）。 */
function bigPreviewOptions() {
  return Object.assign(currentPreviewOptions(), { zoom: 2 });
}

/** 初始化表盘能力：拉清单、挂迷你/大预览、构建下拉选项行。 */
function initFaces() {
  if (!api) return;
  faces = api.listFaces();
  if (faces.length === 0) {
    log('warn', '表盘清单为空（注册表异常）');
    return;
  }
  currentFaceId = faces[0].id;
  triggerPreview = api.mountFacePreview(el.faceTriggerThumb, currentFaceId, currentPreviewOptions());
  bigPreview = api.mountFacePreview(el.faceBig, currentFaceId, bigPreviewOptions());
  buildFacePanelRows();
  updateFaceTriggerInfo();
  log('ok', '表盘已就绪（' + faces.length + ' 款）：' + faces.map((f) => f.label).join('、'));
}

/** 构建下拉选项行（预览在面板展开时惰性挂载，收起即销毁）。 */
function buildFacePanelRows() {
  el.facePanel.innerHTML = '';
  for (const face of faces) {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'face-option';
    row.setAttribute('role', 'option');
    row.dataset.face = face.id;
    const thumb = document.createElement('span');
    thumb.className = 'face-thumb preview-host';
    const name = document.createElement('span');
    name.className = 'face-option-name';
    name.textContent = face.label;
    const kind = document.createElement('span');
    kind.className = 'kind-badge';
    kind.textContent = face.kind === 'analog' ? '模拟' : '数字';
    row.append(thumb, name, kind);
    row.addEventListener('click', () => selectFace(face.id));
    el.facePanel.appendChild(row);
  }
}

/** 展开面板：为每行惰性挂载实时迷你预览。 */
function openFacePanel() {
  if (!api || faces.length === 0) return;
  el.facePanel.hidden = false;
  el.faceTrigger.setAttribute('aria-expanded', 'true');
  optionPreviews = [];
  for (let i = 0; i < faces.length; i++) {
    const row = el.facePanel.children[i];
    const thumb = row ? row.querySelector('.face-thumb') : null;
    if (!(thumb instanceof HTMLElement)) continue;
    optionPreviews.push({ id: faces[i].id, handle: api.mountFacePreview(thumb, faces[i].id, currentPreviewOptions()) });
  }
  document.addEventListener('pointerdown', onOutsidePointerDown, true);
  document.addEventListener('keydown', onPanelKeydown, true);
  log('info', '表盘下拉已展开（' + optionPreviews.length + ' 路迷你预览实时渲染）');
}

/** 收起面板：销毁全部选项预览。 */
function closeFacePanel() {
  if (el.facePanel.hidden) return;
  for (const item of optionPreviews) item.handle.destroy();
  optionPreviews = [];
  el.facePanel.hidden = true;
  el.faceTrigger.setAttribute('aria-expanded', 'false');
  document.removeEventListener('pointerdown', onOutsidePointerDown, true);
  document.removeEventListener('keydown', onPanelKeydown, true);
}

/**
 * 点击面板/触发器外部时收起。
 * @param {PointerEvent} ev
 */
function onOutsidePointerDown(ev) {
  const target = ev.target;
  if (target instanceof Node && (el.facePanel.contains(target) || el.faceTrigger.contains(target))) return;
  closeFacePanel();
}

/**
 * Esc 收起并归还焦点。
 * @param {KeyboardEvent} ev
 */
function onPanelKeydown(ev) {
  if (ev.key === 'Escape') {
    closeFacePanel();
    el.faceTrigger.focus();
  }
}

/**
 * 选择表盘：收起态迷你预览 + 大预览即时联动。
 * @param {string} faceId
 */
function selectFace(faceId) {
  closeFacePanel();
  if (faceId === currentFaceId) return;
  currentFaceId = faceId;
  const opts = currentPreviewOptions();
  if (triggerPreview) triggerPreview.update(faceId, opts);
  if (bigPreview) bigPreview.update(faceId, bigPreviewOptions());
  updateFaceTriggerInfo();
  const face = faces.find((f) => f.id === faceId);
  log('ok', '已选择表盘：' + (face ? face.label : faceId) + '（' + faceId + '）');
  toast('success', '表盘已切换', '重新应用 / 重新挂载后写入运行时配置。');
}

/** 刷新收起态信息（名称 + 种类徽标 + 选项选中态）。 */
function updateFaceTriggerInfo() {
  const face = faces.find((f) => f.id === currentFaceId);
  el.faceTriggerName.textContent = face ? face.label : '（未选择）';
  if (face) {
    el.faceTriggerKind.textContent = face.kind === 'analog' ? '模拟' : '数字';
    el.faceTriggerKind.hidden = false;
  }
  for (const row of el.facePanel.children) {
    if (row instanceof HTMLElement) {
      row.setAttribute('aria-selected', String(row.dataset.face === currentFaceId));
    }
  }
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
  const theme = el.theme.value === 'paper' ? 'paper' : 'midnight';
  const idleSeconds = clampIdle(Number(el.idleCustom.value));
  return {
    enabled: true,
    idle_seconds: idleSeconds,
    exit_cooldown_seconds: EXIT_COOLDOWN_SECONDS,
    theme,
    screensaver_entity: SCREENSAVER_ENTITY,
    components: {
      clock: { show: true, style: currentFaceId || 'digital', hour24: true, seconds: true, position: 'center' },
      calendar: { show: true, week_start: 1, show_week_number: true, format: 'M月D日 dddd', position: 'bottom_center' },
      lunar: { show: true, format: '{lunar_month}{lunar_day} {ganzhi}{zodiac}年', position: 'bottom_center' },
      weather: { show: true, entity: 'weather.home', position: 'top_right' },
      texts: [{ content: '室温 {sensor.temp}°C', position: 'top_left' }],
    },
    background: theme === 'paper'
      ? {
          type: 'gradient', color: '#f5f1e8',
          gradient: { from: '#f5f1e8', to: '#e8e0cf', angle: 160 },
          images: [], interval_seconds: 30, dim: 0,
        }
      : {
          type: el.bgType.value === 'gradient' ? 'gradient' : 'color', color: '#0b1020',
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
  el.faceTrigger.disabled = !bundleReady || faces.length === 0;
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

/* ============================ 配置编辑器集成 ============================ */

/** 切换编辑器折叠态（首次展开时惰性创建元素）。 */
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

/** 惰性创建编辑器元素（一次），并监听 config-changed 防抖记录未应用草稿。 */
function ensureEditor() {
  if (editorEl) return;
  if (!customElements.get('snooze-panel-editor')) {
    log('error', 'snooze-panel-editor 未注册（产物异常）');
    toast('error', '编辑器不可用', '产物未注册 snooze-panel-editor 元素。');
    return;
  }
  const element = /** @type {PanelElementLike} */ (document.createElement('snooze-panel-editor'));
  element.hass = mockHass;
  element.setConfig({ snoozepanel: buildBaseConfig() });
  element.addEventListener('config-changed', (ev) => {
    const detail = /** @type {{ config?: { snoozepanel?: Record<string, unknown> } }} */ (
      /** @type {CustomEvent} */ (ev).detail
    );
    const next = detail.config?.snoozepanel;
    if (!next) return;
    // 防抖 400ms 记录草稿，避免输入过程中频繁刷日志
    if (editorDebounceTimer !== undefined) window.clearTimeout(editorDebounceTimer);
    editorDebounceTimer = window.setTimeout(() => {
      editorDraft = next;
      if (!editorDirty) {
        editorDirty = true;
        el.editorDirty.hidden = false;
        log('info', '编辑器草稿已变更（标记「有未应用变更」）');
      }
    }, 400);
  });
  el.editorHost.appendChild(element);
  editorEl = element;
  log('ok', '配置编辑器已创建（内嵌渲染，深色主题）');
}

/** 重新应用配置：卸载 + 按最新配置重挂（优先编辑器草稿，其次控制面板）。 */
function reapplyConfig() {
  const useDraft = editorDirty && editorDraft !== null;
  const config = useDraft && editorDraft ? editorDraft : buildBaseConfig();
  const ok = mountRuntime(config, true);
  if (!ok) return;
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

/** 主题切换：三处预览联动（运行时需重新挂载生效）。 */
function handleThemeChange() {
  const opts = currentPreviewOptions();
  if (triggerPreview) triggerPreview.update(currentFaceId, opts);
  if (bigPreview) bigPreview.update(currentFaceId, bigPreviewOptions());
  for (const item of optionPreviews) item.handle.update(item.id, opts);
  log('info', '主题切换为 ' + opts.theme + '（预览已联动；运行时需重新挂载生效）');
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
  el.faceTrigger.addEventListener('click', () => {
    if (el.facePanel.hidden) openFacePanel();
    else closeFacePanel();
  });
  el.theme.addEventListener('change', handleThemeChange);
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

/** 启动：初始禁用 → 加载产物 → 初始化表盘与设备列表 → 状态轮询。 */
async function bootstrap() {
  // PrimeVue 深色主题（编辑器内部组件跟随；与实测台整体风格一致）
  document.documentElement.classList.add('snooze-editor-dark');
  updateActionButtons();
  log('info', '本地实测台启动：mock hass + mock 后端已就绪');
  await loadBundle();
  await refreshDeviceList();
  window.setInterval(updateRuntimeStatus, 250);
  updateRuntimeStatus();
}

bindEvents();
void bootstrap();
