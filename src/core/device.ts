/**
 * 设备识别与白/黑名单匹配。
 *
 * 设备 id 解析优先级：
 *   1. URL 查询参数 ?snooze_device=xxx
 *   2. localStorage 持久化的自动生成 id（dev-xxxxxx）
 */

import type { DeviceFilter } from './types';

const STORAGE_KEY = 'snoozepanel-device';
const PARAM_KEY = 'snooze_device';

function randomId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let s = '';
  for (let i = 0; i < 6; i++) {
    s += chars[Math.floor(Math.random() * chars.length)];
  }
  return `dev-${s}`;
}

/**
 * 解析当前设备 id。
 * @param search window.location.search（可注入便于测试）
 * @param storage localStorage 兼容接口（可注入便于测试）
 */
export function resolveDeviceId(
  search: string = typeof window !== 'undefined' ? window.location.search : '',
  storage: Pick<Storage, 'getItem' | 'setItem'> | null = typeof window !== 'undefined' ? window.localStorage : null,
): string {
  // 1. URL 参数优先
  const params = new URLSearchParams(search);
  const fromUrl = params.get(PARAM_KEY);
  if (fromUrl && fromUrl.trim()) {
    return fromUrl.trim();
  }

  // 2. localStorage 持久化
  if (storage) {
    try {
      const existing = storage.getItem(STORAGE_KEY);
      if (existing && existing.trim()) {
        return existing.trim();
      }
      const created = randomId();
      storage.setItem(STORAGE_KEY, created);
      return created;
    } catch {
      // localStorage 不可用（隐私模式等），退化为临时 id
      return randomId();
    }
  }
  return randomId();
}

/**
 * 设备是否被允许使用屏保。
 * 无过滤器（null）→ 全部允许。
 * whitelist：仅 list 内允许；blacklist：list 内禁止。
 */
export function isDeviceAllowed(deviceId: string, filter: DeviceFilter | null): boolean {
  if (!filter) return true;
  const inList = filter.list.includes(deviceId);
  return filter.mode === 'whitelist' ? inList : !inList;
}
