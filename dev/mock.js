// @ts-check
/**
 * dev 实测台的 mock hass 与 mock 后端（仅内存，无外发请求），
 * 以及 mock 后端「已保存设备 / 已安装插件」列表的拉取与渲染。
 *
 * @typedef {import('./types.js').MockEntityState} MockEntityState
 * @typedef {import('./types.js').MockHass} MockHass
 */
import { SCREENSAVER_ENTITY } from './constants.js';
import { el } from './state.js';
import { log, toast } from './log.js';

/**
 * mock 插件安装记录（与 src/core/pluginTypes.ts 的 PluginRecord 对齐）。
 * @typedef {Object} MockPluginRecord
 * @property {string} id
 * @property {'face' | 'widget'} kind
 * @property {'dir' | 'upload'} channel
 * @property {string} entry
 * @property {boolean} enabled
 * @property {Record<string, unknown>} manifest
 * @property {string} [code]
 * @property {number} [installed_at]
 */

/** mock 后端存储（内存对象，模拟 custom component 的 .storage/：devices + plugins 两分区） */
/** @type {{ devices: Record<string, unknown>, plugins: Record<string, MockPluginRecord> }} */
const mockStore = { devices: {}, plugins: {} };

/**
 * 插件限额（镜像 src/core/pluginLimits.ts 与后端 const.py，保持同口径）。
 * 仅供 dev 验证「后端强制校验」路径；真实安全边界在 HA 后端。
 */
const MAX_JS_BYTES = 512 * 1024;
const MAX_MANIFEST_BYTES = 64 * 1024;
const MAX_RECORD_BYTES = 1024 * 1024;
const MAX_PLUGINS = 100;
const PLUGIN_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;

/**
 * 校验插件记录（镜像 pluginLimits：类型 / 大小 / 数量 / 内容 / 路径）。
 * @param {MockPluginRecord} record
 * @returns {string | null} 非法原因；合法返回 null
 */
function validateRecord(record) {
  if (!record || typeof record.id !== 'string' || !PLUGIN_ID_PATTERN.test(record.id)) {
    return '插件 id 非法（需 ^[a-z0-9][a-z0-9-]{0,63}$）';
  }
  if (record.kind !== 'face' && record.kind !== 'widget') return 'kind 非法';
  if (record.channel !== 'dir' && record.channel !== 'upload') return 'channel 非法';
  const entry = String(record.entry || (record.manifest && record.manifest.entry) || 'index.js');
  if (entry.includes('..') || entry.startsWith('/') || entry.includes('\\') || !entry.toLowerCase().endsWith('.js')) {
    return 'entry 非法（仅纯 .js 文件名，禁路径穿越）';
  }
  const manifestText = JSON.stringify(record.manifest || {});
  if (manifestText.length > MAX_MANIFEST_BYTES) return '清单超过 64 KB';
  if (record.code != null) {
    if (typeof record.code !== 'string' || record.code.indexOf('\0') >= 0) return '脚本内容非法（含 NUL）';
    if (record.code.length > MAX_JS_BYTES) return '脚本超过 512 KB';
  }
  const total = (record.code ? record.code.length : 0) + manifestText.length;
  if (total > MAX_RECORD_BYTES) return '安装记录超过 1 MB';
  if (!(record.id in mockStore.plugins) && Object.keys(mockStore.plugins).length >= MAX_PLUGINS) {
    return '已达插件数量上限（100 个）';
  }
  return null;
}

/**
 * 修改 mock 屏保实体状态。
 * @param {'on' | 'off'} state
 * @param {boolean} [silent] 静默模式（callService 回写时不重复记日志）
 */
export function setScreensaverEntityState(state, silent = false) {
  const st = mockHass.states[SCREENSAVER_ENTITY];
  if (!st) return;
  const changed = st.state !== state;
  st.state = state;
  if (!silent && changed) log('info', 'mock 实体 ' + SCREENSAVER_ENTITY + ' → ' + state);
}

/** mock hass：实体 / 用户 / 服务调用 / WS 后端读写（仅内存，无外发请求） */
/** @type {MockHass} */
export const mockHass = {
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
    if (type === 'snoozepanel/list_plugins') {
      const plugins = Object.values(mockStore.plugins);
      log('info', 'mock WS list_plugins → ' + plugins.length + ' 个已安装');
      return { plugins };
    }
    if (type === 'snoozepanel/install_plugin') {
      const record = /** @type {MockPluginRecord} */ (msg.record);
      const err = validateRecord(record);
      if (err) {
        log('error', 'mock WS install_plugin 被拒绝：' + err);
        toast('error', '插件安装被拒绝（后端限额）', err);
        throw new Error('插件非法：' + err);
      }
      mockStore.plugins[record.id] = record;
      log('ok', 'mock WS install_plugin → 已落盘插件 ' + record.id + '（' + record.kind + '/' + record.channel + '）');
      toast('success', '插件已安装到 mock 后端', record.id);
      void refreshPluginList();
      return { success: true };
    }
    if (type === 'snoozepanel/uninstall_plugin') {
      const id = String(msg.id);
      const had = id in mockStore.plugins;
      delete mockStore.plugins[id];
      log('warn', 'mock WS uninstall_plugin → ' + id + (had ? ' 已卸载' : ' 不存在'));
      void refreshPluginList();
      return { success: had };
    }
    if (type === 'snoozepanel/set_plugin_enabled') {
      const id = String(msg.id);
      const rec = mockStore.plugins[id];
      if (!rec) return { success: false };
      rec.enabled = Boolean(msg.enabled);
      log('info', 'mock WS set_plugin_enabled → ' + id + ' → ' + (rec.enabled ? '启用' : '停用'));
      void refreshPluginList();
      return { success: true };
    }
    log('error', 'mock WS 收到未知命令：' + type);
    throw new Error('未知 WS 命令: ' + type);
  },
};

/** 拉取并渲染 mock 后端已保存设备。 */
export async function refreshDeviceList() {
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
export async function deleteDevice(id) {
  try {
    await mockHass.callWS({ type: 'snoozepanel/delete_config', device_id: id });
    toast('warning', '已删除设备配置', id);
    await refreshDeviceList();
  } catch (err) {
    log('error', '删除设备配置失败：' + String(err));
  }
}

/** 拉取并渲染 mock 后端已安装插件。 */
export async function refreshPluginList() {
  try {
    const res = /** @type {{ plugins?: MockPluginRecord[] }} */ (
      await mockHass.callWS({ type: 'snoozepanel/list_plugins' })
    );
    renderPluginList(res.plugins ?? []);
  } catch (err) {
    log('error', '插件列表刷新失败：' + String(err));
  }
}

/**
 * 渲染插件列表（每项含种类/启用状态与卸载按钮）。
 * @param {MockPluginRecord[]} plugins
 */
function renderPluginList(plugins) {
  el.pluginList.innerHTML = '';
  if (plugins.length === 0) {
    const li = document.createElement('li');
    li.className = 'dim';
    li.textContent = '尚未安装任何插件';
    el.pluginList.appendChild(li);
    return;
  }
  for (const p of plugins) {
    const li = document.createElement('li');
    const code = document.createElement('code');
    code.textContent = p.id;
    const meta = document.createElement('span');
    meta.className = 'dim';
    meta.textContent = p.kind + ' · ' + (p.enabled ? '启用' : '停用');
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'btn ghost tiny';
    del.textContent = '卸载';
    del.addEventListener('click', () => { void deletePlugin(p.id); });
    li.append(code, meta, del);
    el.pluginList.appendChild(li);
  }
}

/**
 * 卸载某插件。
 * @param {string} id
 */
export async function deletePlugin(id) {
  try {
    await mockHass.callWS({ type: 'snoozepanel/uninstall_plugin', id });
    toast('warning', '已卸载插件', id);
    await refreshPluginList();
  } catch (err) {
    log('error', '卸载插件失败：' + String(err));
  }
}
