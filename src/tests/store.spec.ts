import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadDeviceConfig, saveDeviceConfig, mergeConfig } from '../core/store';
import { DEFAULT_CONFIG } from '../core/types';
import type { HassLike } from '../core/hass';

/** 构造带可编程 callWS 的 mock hass */
function mockHass(callWS?: HassLike['callWS']): HassLike {
  return { states: {}, callWS };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('loadDeviceConfig 读取设备配置', () => {
  it('后端命中返回配置', async () => {
    const callWS = vi.fn().mockResolvedValue({ config: { theme: 'paper' } });
    const res = await loadDeviceConfig(mockHass(callWS), 'dev-a');
    expect(callWS).toHaveBeenCalledWith({ type: 'snoozepanel/get_config', device_id: 'dev-a' });
    expect(res).toEqual({ theme: 'paper' });
  });

  it('后端无该设备配置返回 null', async () => {
    const callWS = vi.fn().mockResolvedValue({ config: null });
    expect(await loadDeviceConfig(mockHass(callWS), 'dev-x')).toBeNull();
  });

  it('后端不可用（无 callWS）返回 null 并告警', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const res = await loadDeviceConfig(mockHass(undefined), 'dev-a');
    expect(res).toBeNull();
    expect(warn).toHaveBeenCalledOnce();
  });

  it('WS 异常返回 null（降级视图 YAML）', async () => {
    const callWS = vi.fn().mockRejectedValue(new Error('connection lost'));
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await loadDeviceConfig(mockHass(callWS), 'dev-a')).toBeNull();
  });
});

describe('saveDeviceConfig 写入设备配置', () => {
  it('后端可用写入成功返回 true', async () => {
    const callWS = vi.fn().mockResolvedValue({ success: true });
    const ok = await saveDeviceConfig(mockHass(callWS), 'dev-a', { theme: 'paper' });
    expect(callWS).toHaveBeenCalledWith({ type: 'snoozepanel/set_config', device_id: 'dev-a', config: { theme: 'paper' } });
    expect(ok).toBe(true);
  });

  it('后端不可用返回 false 且不写 localStorage', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const ok = await saveDeviceConfig(mockHass(undefined), 'dev-a', { theme: 'paper' });
    expect(ok).toBe(false);
    expect(warn).toHaveBeenCalledOnce();
  });

  it('WS 异常返回 false', async () => {
    const callWS = vi.fn().mockRejectedValue(new Error('io error'));
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await saveDeviceConfig(mockHass(callWS), 'dev-a', {})).toBe(false);
  });
});

describe('mergeConfig 配置合并', () => {
  it('无覆盖返回基础配置', () => {
    expect(mergeConfig(DEFAULT_CONFIG, null)).toBe(DEFAULT_CONFIG);
  });

  it('顶层字段被覆盖', () => {
    const merged = mergeConfig(DEFAULT_CONFIG, { idle_seconds: 300 });
    expect(merged.idle_seconds).toBe(300);
    expect(merged.theme).toBe(DEFAULT_CONFIG.theme); // 未覆盖字段保留
  });

  it('设备可单独覆盖表盘而不影响其他 clock 字段', () => {
    const merged = mergeConfig(DEFAULT_CONFIG, { components: { clock: { style: 'chrono' } } as never });
    expect(merged.components.clock.style).toBe('chrono');
    expect(merged.components.clock.hour24).toBe(DEFAULT_CONFIG.components.clock.hour24);
    expect(merged.components.clock.position).toBe(DEFAULT_CONFIG.components.clock.position);
  });

  it('background 浅合并', () => {
    const merged = mergeConfig(DEFAULT_CONFIG, { background: { dim: 0.8 } as never });
    expect(merged.background.dim).toBe(0.8);
    expect(merged.background.color).toBe(DEFAULT_CONFIG.background.color);
  });
});
