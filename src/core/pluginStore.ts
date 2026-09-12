/**
 * 插件安装记录的读写封装层（HA 后端 .storage/）。
 *
 * 与 store.ts 同风格：优先 hass.callWS；后端不可用时读 → 返回空 / 写 → 返回 false，
 * 不写 localStorage（配置持久化必须走后端，见架构决策 9）。
 */

import type { HassLike } from './hass';
import type { PluginRecord } from './pluginTypes';

/** WS 命令类型（与后端 const.py 对应） */
const WS_LIST = 'snoozepanel/list_plugins';
const WS_INSTALL = 'snoozepanel/install_plugin';
const WS_UNINSTALL = 'snoozepanel/uninstall_plugin';
const WS_SET_ENABLED = 'snoozepanel/set_plugin_enabled';

/** 后端是否可用（hass.callWS 存在即认为可尝试） */
function backendAvailable(hass: HassLike): boolean {
  return typeof hass.callWS === 'function';
}

/** 读取全部插件安装记录 */
export async function listPlugins(hass: HassLike): Promise<PluginRecord[]> {
  if (!backendAvailable(hass)) return [];
  try {
    const res = await hass.callWS!<{ plugins: PluginRecord[] }>({ type: WS_LIST });
    return Array.isArray(res?.plugins) ? res.plugins : [];
  } catch (err) {
    console.warn('[snoozepanel] 读取插件列表失败：', err);
    return [];
  }
}

/** 安装（或覆盖）一条插件记录。失败返回 false（含后端限额拒绝） */
export async function installPlugin(hass: HassLike, record: PluginRecord): Promise<boolean> {
  if (!backendAvailable(hass)) {
    console.warn('[snoozepanel] 后端不可用（无 callWS），插件未安装');
    return false;
  }
  try {
    await hass.callWS!({ type: WS_INSTALL, record });
    return true;
  } catch (err) {
    console.warn('[snoozepanel] 安装插件失败：', err);
    return false;
  }
}

/** 卸载指定插件；返回是否确有删除 */
export async function uninstallPlugin(hass: HassLike, id: string): Promise<boolean> {
  if (!backendAvailable(hass)) return false;
  try {
    const res = await hass.callWS!<{ success: boolean }>({ type: WS_UNINSTALL, id });
    return Boolean(res?.success);
  } catch (err) {
    console.warn('[snoozepanel] 卸载插件失败：', err);
    return false;
  }
}

/** 启用 / 禁用指定插件；返回是否成功 */
export async function setPluginEnabled(hass: HassLike, id: string, enabled: boolean): Promise<boolean> {
  if (!backendAvailable(hass)) return false;
  try {
    const res = await hass.callWS!<{ success: boolean }>({ type: WS_SET_ENABLED, id, enabled });
    return Boolean(res?.success);
  } catch (err) {
    console.warn('[snoozepanel] 切换插件启用状态失败：', err);
    return false;
  }
}
