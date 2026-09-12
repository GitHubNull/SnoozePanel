import { describe, it, expect } from 'vitest';
import {
  SCREEN_PRESETS,
  CUSTOM_PRESET_ID,
  SCREEN_DIM_LIMITS,
  DEFAULT_SCREEN,
  presetById,
  clampScreenDim,
  matchPreset,
  resolveScreen,
} from '../core/screen';

describe('SCREEN_PRESETS 预设注册表', () => {
  it('id 无重复且尺寸/名称合法', () => {
    const ids = SCREEN_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const p of SCREEN_PRESETS) {
      expect(p.id.trim().length).toBeGreaterThan(0);
      expect(p.label.trim().length).toBeGreaterThan(0);
      expect(p.width).toBeGreaterThan(0);
      expect(p.height).toBeGreaterThan(0);
      expect(Number.isInteger(p.width)).toBe(true);
      expect(Number.isInteger(p.height)).toBe(true);
    }
  });

  it('默认尺寸命中预设', () => {
    expect(presetById(DEFAULT_SCREEN.preset)).toBeDefined();
  });
});

describe('presetById', () => {
  it('命中返回预设', () => {
    expect(presetById('watch-360')?.width).toBe(360);
    expect(presetById('tablet-1280')?.height).toBe(800);
  });

  it('未命中返回 undefined', () => {
    expect(presetById('nope')).toBeUndefined();
    expect(presetById(CUSTOM_PRESET_ID)).toBeUndefined();
  });
});

describe('clampScreenDim 夹取', () => {
  it('夹取到 [min,max]', () => {
    expect(clampScreenDim(10, 800)).toBe(SCREEN_DIM_LIMITS.min);
    expect(clampScreenDim(99999, 800)).toBe(SCREEN_DIM_LIMITS.max);
  });

  it('非法值回退 fallback', () => {
    expect(clampScreenDim('abc', 640)).toBe(640);
    expect(clampScreenDim(NaN, 640)).toBe(640);
    expect(clampScreenDim(Infinity, 640)).toBe(640);
    expect(clampScreenDim(undefined, 640)).toBe(640);
  });

  it('可强制转数值者按数值夹取', () => {
    expect(clampScreenDim('360', 800)).toBe(360);
    // Number(null) === 0，落入下限
    expect(clampScreenDim(null, 640)).toBe(SCREEN_DIM_LIMITS.min);
  });

  it('合法值取整', () => {
    expect(clampScreenDim(390.6, 800)).toBe(391);
  });
});

describe('matchPreset 宽高匹配', () => {
  it('命中返回预设 id', () => {
    expect(matchPreset(360, 360)).toBe('watch-360');
    expect(matchPreset(1280, 800)).toBe('tablet-1280');
  });

  it('未命中返回 custom', () => {
    expect(matchPreset(800, 600)).toBe(CUSTOM_PRESET_ID);
    expect(matchPreset(360, 361)).toBe(CUSTOM_PRESET_ID);
  });
});

describe('resolveScreen 解析', () => {
  it('提供合法宽高时透传并按实际尺寸校正 preset', () => {
    expect(resolveScreen('watch-360', 360, 360)).toEqual({ preset: 'watch-360', width: 360, height: 360 });
    expect(resolveScreen('custom', 800, 600)).toEqual({ preset: CUSTOM_PRESET_ID, width: 800, height: 600 });
  });

  it('宽高夹取到边界并回正 preset', () => {
    expect(resolveScreen('custom', 10, 99999)).toEqual({
      preset: CUSTOM_PRESET_ID,
      width: SCREEN_DIM_LIMITS.min,
      height: SCREEN_DIM_LIMITS.max,
    });
  });

  it('仅给 preset 且命中时回填预设宽高', () => {
    expect(resolveScreen('phone-390', undefined, undefined)).toEqual({ preset: 'phone-390', width: 390, height: 844 });
  });

  it('仅给 preset 但未命中且无宽高时回退默认', () => {
    expect(resolveScreen('nope', undefined, undefined)).toEqual(DEFAULT_SCREEN);
    expect(resolveScreen(123, undefined, undefined)).toEqual(DEFAULT_SCREEN);
  });

  it('preset 缺省（空串）视为自定义', () => {
    expect(resolveScreen('', 800, 600)).toEqual({ preset: CUSTOM_PRESET_ID, width: 800, height: 600 });
    // 空 preset 且无宽高：无命中预设 → 默认
    expect(resolveScreen('   ', undefined, undefined)).toEqual(DEFAULT_SCREEN);
  });
});
