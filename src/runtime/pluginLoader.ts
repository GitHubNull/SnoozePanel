/**
 * 运行时插件加载器：把「预编译插件包」注入页面并注册到运行时注册表。
 *
 * 两条通道（均为同源 / 本地 Blob，不引入任何外发请求）：
 *   - dir   ：<script src="/local/snoozepanel/plugins/<id>/<entry>">（HA 静态目录 config/www）
 *   - upload：new Blob([code]) + URL.createObjectURL 注入 <script src="blob:...">
 *
 * 限制：已注入的同源脚本无法真正卸载（浏览器不允许移除已执行的脚本），
 * 卸载仅从运行时注册表移除；重新加载需刷新页面。
 */

import { getPluginSDK, installPluginSDK } from '@/ui/plugins/sdk';
import { unregisterRuntimeFace } from '@/ui/faces/registry';
import { unregisterRuntimeWidget } from '@/ui/widgets/registry';
import { listPlugins } from '@/core/pluginStore';
import { checkEntryPath, isValidPluginId } from '@/core/pluginLimits';
import type { HassLike } from '@/core/hass';
import type { PluginRecord } from '@/core/pluginTypes';

/** HA /local 插件目录基址（对应 config/www/snoozepanel/plugins/） */
export const PLUGIN_DIR_BASE = '/local/snoozepanel/plugins';

/** 加载结果 */
export interface LoadResult {
  id: string;
  ok: boolean;
  error?: string;
}

/** 注入 <script> 并等待加载完成（onload / onerror） */
function injectScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = false;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('脚本加载失败：' + src));
    document.head.appendChild(script);
  });
}

/** 解析插件脚本地址；上传通道额外返回 blob URL 的回收函数 */
function resolveSource(record: PluginRecord): { src: string; revoke: () => void } {
  if (record.channel === 'upload') {
    const url = URL.createObjectURL(new Blob([record.code ?? ''], { type: 'text/javascript' }));
    return { src: url, revoke: () => URL.revokeObjectURL(url) };
  }
  const entry = record.entry || record.manifest.entry || 'index.js';
  return { src: `${PLUGIN_DIR_BASE}/${record.id}/${entry}`, revoke: () => {} };
}

/** 加载单个插件记录：注入脚本并校验注册结果 */
export async function loadPlugin(record: PluginRecord): Promise<LoadResult> {
  if (!record || !isValidPluginId(record.id)) {
    return { id: record?.id ?? '', ok: false, error: '插件 id 非法' };
  }
  if (record.channel === 'dir') {
    const check = checkEntryPath(record.entry || record.manifest.entry || 'index.js');
    if (!check.ok) return { id: record.id, ok: false, error: check.error };
  }
  const sdk = installPluginSDK();
  sdk.__expect = { id: record.id };
  sdk.__last = null;
  const { src, revoke } = resolveSource(record);
  try {
    await injectScript(src);
  } catch (err) {
    revoke();
    return { id: record.id, ok: false, error: err instanceof Error ? err.message : String(err) };
  } finally {
    sdk.__expect = null;
  }
  revoke();
  // 以插件自注册结果（registerFace/registerWidget 写入的 __last）判定是否注册成功，
  // 避免依赖 record 中可能缺失的 manifest.type/style。
  if (!sdk.__last) {
    return { id: record.id, ok: false, error: '脚本未注册插件（缺少 registerFace / registerWidget 调用？）' };
  }
  return { id: record.id, ok: true };
}

/** 启动时加载全部「已启用」的已安装插件 */
export async function loadInstalledPlugins(hass: HassLike): Promise<LoadResult[]> {
  const records = await listPlugins(hass);
  const results: LoadResult[] = [];
  for (const record of records) {
    if (!record.enabled) continue;
    results.push(await loadPlugin(record));
  }
  return results;
}

/** 从运行时注册表卸载插件（同源脚本本身无法卸载，仅移除注册） */
export function unloadPlugin(record: PluginRecord): boolean {
  if (record.kind === 'face') return unregisterRuntimeFace(record.id);
  return unregisterRuntimeWidget(record.manifest.type ?? '', record.manifest.style ?? '');
}

/** 当前 SDK 是否已安装（供调用方判断页面是否已初始化插件通道） */
export function pluginRuntimeReady(): boolean {
  return Boolean(getPluginSDK());
}
