/**
 * 市场「插件安装 / 卸载 / 启停」组合式函数。
 *
 * 封装第三方插件的运行时注册表操作与后端记录读写，供表盘市场与内容组件市场复用：
 *   - installVisible：安装弹窗开合；
 *   - installed：当前已安装插件记录（含启用态）；
 *   - refresh：从后端拉取安装记录；
 *   - uninstallEntry / setEntryEnabled：按市场条目定位后端记录并执行操作，
 *     同时同步运行时注册表（移除）。
 *
 * 说明：已注入的同源脚本无法真正卸载，卸载仅从运行时注册表移除（见 pluginLoader）。
 */
import { ref, type Ref } from 'vue';
import { listPlugins, setPluginEnabled, uninstallPlugin } from '@/core/pluginStore';
import { unregisterRuntimeFace } from '@/ui/faces/registry';
import { unregisterRuntimeWidget } from '@/ui/widgets/registry';
import type { HassLike } from '@/core/hass';
import type { PluginKind, PluginRecord } from '@/core/pluginTypes';
import type { MarketEntry } from './types';

/** 已安装插件的精简视图 */
export interface InstalledPlugin {
  id: string;
  kind: PluginKind;
  enabled: boolean;
  type?: string;
  style?: string;
}

/** 组合式函数返回值 */
export interface PluginInstallApi {
  /** 安装弹窗开合 */
  installVisible: Ref<boolean>;
  /** 已安装插件（含启用态） */
  installed: Ref<InstalledPlugin[]>;
  openInstall: () => void;
  closeInstall: () => void;
  /** 从后端刷新安装记录 */
  refresh: () => Promise<void>;
  /** 卸载市场条目对应的插件（同步移除运行时注册） */
  uninstallEntry: (entry: MarketEntry) => Promise<boolean>;
  /** 启用 / 禁用市场条目对应的插件 */
  setEntryEnabled: (entry: MarketEntry, enabled: boolean) => Promise<boolean>;
  /** 查询某条目是否启用（非安装项返回 false） */
  isEnabled: (entry: MarketEntry) => boolean;
}

/** 按市场条目在后端记录中定位插件 */
function locate(records: PluginRecord[], entry: MarketEntry): PluginRecord | undefined {
  if (entry.type) {
    return records.find((r) => `${r.manifest.type}/${r.manifest.style}` === entry.key);
  }
  return records.find((r) => r.id === entry.key);
}

/**
 * 创建市场插件安装 / 卸载 / 启停控制器。
 * @param getHass 惰性获取 hass（宿主可能异步注入）
 */
export function usePluginInstall(getHass: () => HassLike | null): PluginInstallApi {
  const installVisible = ref(false);
  const installed = ref<InstalledPlugin[]>([]);

  async function refresh(): Promise<void> {
    const hass = getHass();
    if (!hass) return;
    const list = await listPlugins(hass);
    installed.value = list.map((r) => ({
      id: r.id,
      kind: r.kind,
      enabled: r.enabled !== false,
      type: r.manifest?.type,
      style: r.manifest?.style,
    }));
  }

  function openInstall(): void {
    installVisible.value = true;
  }
  function closeInstall(): void {
    installVisible.value = false;
  }

  function isEnabled(entry: MarketEntry): boolean {
    return installed.value.some(
      (p) => (entry.type ? `${p.type}/${p.style}` === entry.key : p.id === entry.key) && p.enabled,
    );
  }

  async function uninstallEntry(entry: MarketEntry): Promise<boolean> {
    const hass = getHass();
    if (!hass) return false;
    const list = await listPlugins(hass);
    const rec = locate(list, entry);
    const id = rec?.id ?? entry.key;
    await uninstallPlugin(hass, id);
    if (entry.type) unregisterRuntimeWidget(entry.type, entry.style ?? entry.value);
    else unregisterRuntimeFace(entry.key);
    installed.value = installed.value.filter((p) => p.id !== id);
    return true;
  }

  async function setEntryEnabled(entry: MarketEntry, enabled: boolean): Promise<boolean> {
    const hass = getHass();
    if (!hass) return false;
    const list = await listPlugins(hass);
    const rec = locate(list, entry);
    if (!rec) return false;
    const ok = await setPluginEnabled(hass, rec.id, enabled);
    if (ok) {
      const p = installed.value.find((x) => x.id === rec.id);
      if (p) p.enabled = enabled;
    }
    return ok;
  }

  return { installVisible, installed, openInstall, closeInstall, refresh, uninstallEntry, setEntryEnabled, isEnabled };
}
