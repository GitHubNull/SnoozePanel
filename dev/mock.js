// @ts-check
/**
 * dev 实测台的 mock hass 与 mock 后端（仅内存，无外发请求），
 * 以及 mock 后端「已保存设备」列表的拉取与渲染。
 *
 * @typedef {import('./types.js').MockEntityState} MockEntityState
 * @typedef {import('./types.js').MockHass} MockHass
 */
import { SCREENSAVER_ENTITY } from './constants.js';
import { el } from './state.js';
import { log, toast } from './log.js';

/** mock 后端存储（内存对象，模拟 custom component 的 .storage/） */
/** @type {{ devices: Record<string, unknown> }} */
const mockStore = { devices: {} };

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
