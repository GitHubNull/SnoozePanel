import { describe, it, expect } from 'vitest';
import {
  ZOOM_PRESETS,
  ZOOM_LIMITS,
  DEFAULT_ZOOM_PERCENT,
  clampZoomPercent,
} from '../editor/useEditorLayout';

describe('ZOOM_LIMITS / ZOOM_PRESETS 约束', () => {
  it('范围严格大于 0 且小于 500（不允许缩放到 0/负数，也不允许放大到 5 倍及以上）', () => {
    expect(ZOOM_LIMITS.min).toBeGreaterThan(0);
    expect(ZOOM_LIMITS.max).toBeLessThan(500);
  });

  it('所有预设档位均落在可调范围内', () => {
    for (const p of ZOOM_PRESETS) {
      expect(p).toBeGreaterThanOrEqual(ZOOM_LIMITS.min);
      expect(p).toBeLessThanOrEqual(ZOOM_LIMITS.max);
    }
  });
});

describe('clampZoomPercent 夹取', () => {
  it('0 / 负数等明显不合适比例夹取到下限', () => {
    expect(clampZoomPercent(0)).toBe(ZOOM_LIMITS.min);
    expect(clampZoomPercent(-5)).toBe(ZOOM_LIMITS.min);
    expect(clampZoomPercent(-0.1)).toBe(ZOOM_LIMITS.min);
  });

  it('500 及以上（放大 5 倍起）夹取到上限', () => {
    expect(clampZoomPercent(500)).toBe(ZOOM_LIMITS.max);
    expect(clampZoomPercent(1000)).toBe(ZOOM_LIMITS.max);
  });

  it('合法值原样保留', () => {
    expect(clampZoomPercent(100)).toBe(100);
    expect(clampZoomPercent(125)).toBe(125);
    expect(clampZoomPercent(400)).toBe(400);
  });

  it('可强制转数值者按数值夹取', () => {
    expect(clampZoomPercent('50')).toBe(50);
    // Number(null) === 0，落入下限
    expect(clampZoomPercent(null)).toBe(ZOOM_LIMITS.min);
  });

  it('非法值回退默认档位', () => {
    expect(clampZoomPercent(NaN)).toBe(DEFAULT_ZOOM_PERCENT);
    expect(clampZoomPercent(Infinity)).toBe(DEFAULT_ZOOM_PERCENT);
    expect(clampZoomPercent(undefined)).toBe(DEFAULT_ZOOM_PERCENT);
    expect(clampZoomPercent('abc')).toBe(DEFAULT_ZOOM_PERCENT);
  });
});
