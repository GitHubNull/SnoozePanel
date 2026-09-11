import { describe, it, expect } from 'vitest';
import { resolveDeviceId, isDeviceAllowed } from '../core/device';

function memStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => { map.set(k, v); },
    _map: map,
  };
}

describe('resolveDeviceId 设备 id 解析', () => {
  it('URL 查询参数优先', () => {
    const id = resolveDeviceId('?snooze_device=pad-kitchen', memStorage());
    expect(id).toBe('pad-kitchen');
  });

  it('URL 参数优先于 localStorage 已有值', () => {
    const id = resolveDeviceId('?snooze_device=pad-kitchen', memStorage({ 'snoozepanel-device': 'dev-old' }));
    expect(id).toBe('pad-kitchen');
  });

  it('无 URL 参数时复用 localStorage', () => {
    const id = resolveDeviceId('', memStorage({ 'snoozepanel-device': 'dev-saved' }));
    expect(id).toBe('dev-saved');
  });

  it('无 URL 无缓存时自动生成并持久化', () => {
    const storage = memStorage();
    const id = resolveDeviceId('', storage);
    expect(id).toMatch(/^dev-[a-z0-9]{6}$/);
    expect(storage.getItem('snoozepanel-device')).toBe(id);
  });

  it('localStorage 抛错时退化为临时 id', () => {
    const broken = {
      getItem: () => { throw new Error('denied'); },
      setItem: () => { throw new Error('denied'); },
    };
    const id = resolveDeviceId('', broken);
    expect(id).toMatch(/^dev-[a-z0-9]{6}$/);
  });
});

describe('isDeviceAllowed 白/黑名单', () => {
  it('无过滤器全部允许', () => {
    expect(isDeviceAllowed('dev-a', null)).toBe(true);
  });

  it('白名单仅 list 内允许', () => {
    const f = { mode: 'whitelist' as const, list: ['dev-a', 'dev-b'] };
    expect(isDeviceAllowed('dev-a', f)).toBe(true);
    expect(isDeviceAllowed('dev-c', f)).toBe(false);
  });

  it('黑名单 list 内禁止', () => {
    const f = { mode: 'blacklist' as const, list: ['dev-x'] };
    expect(isDeviceAllowed('dev-x', f)).toBe(false);
    expect(isDeviceAllowed('dev-y', f)).toBe(true);
  });
});
