import { describe, it, expect } from 'vitest';
import {
  PX_PER_INCH,
  PX_PER_CM,
  PX_PER_MM,
  computeRulerTicks,
  RULER_UNIT_LABEL,
} from '../core/ruler';

describe('标尺单位换算常量（标准 96dpi）', () => {
  it('英寸 / 厘米 / 毫米像素比', () => {
    expect(PX_PER_INCH).toBe(96);
    expect(PX_PER_CM).toBeCloseTo(37.795, 3);
    expect(PX_PER_MM).toBeCloseTo(3.7795, 4);
  });

  it('单位文案', () => {
    expect(RULER_UNIT_LABEL.px).toBe('px');
    expect(RULER_UNIT_LABEL.cm).toBe('cm');
    expect(RULER_UNIT_LABEL.mm).toBe('mm');
  });
});

describe('computeRulerTicks 刻度生成', () => {
  it('分辨率 px：1280 主刻度步长 200、次刻度 40', () => {
    const ticks = computeRulerTicks(1280, 'px');
    // 首刻度为原点主刻度
    expect(ticks[0]).toMatchObject({ pos: 0, major: true, label: '0' });
    // 第 5 个刻度（5 × 40px）为主刻度 200
    expect(ticks[5].pos).toBe(200);
    expect(ticks[5].major).toBe(true);
    expect(ticks[5].label).toBe('200');
    // 末刻度落在 1280 处（i=32 为次刻度）
    expect(ticks[ticks.length - 1].pos).toBe(1280);
    // 主刻度数量：0..1200 共 7 个
    expect(ticks.filter((t) => t.major).length).toBe(7);
  });

  it('厘米：1280px 主刻度步长 5cm，次刻度 1cm', () => {
    const ticks = computeRulerTicks(1280, 'cm');
    expect(ticks[5].major).toBe(true);
    expect(ticks[5].label).toBe('5');
    expect(ticks[5].pos).toBeCloseTo(188.976, 2);
    // 主刻度：0,5,10,15,20,25,30 cm 共 7 个
    expect(ticks.filter((t) => t.major).length).toBe(7);
  });

  it('毫米：1280px 主刻度步长 50mm（次刻度 10mm）避免过密', () => {
    const ticks = computeRulerTicks(1280, 'mm');
    expect(ticks[5].major).toBe(true);
    expect(ticks[5].label).toBe('50');
    expect(ticks[5].pos).toBeCloseTo(188.976, 2);
  });

  it('小尺寸（手表 360px）px 单位主刻度步长 50', () => {
    const ticks = computeRulerTicks(360, 'px');
    expect(ticks[5].pos).toBe(50);
    expect(ticks[5].label).toBe('50');
  });

  it('非正尺寸返回空数组', () => {
    expect(computeRulerTicks(0, 'px')).toEqual([]);
    expect(computeRulerTicks(-100, 'cm')).toEqual([]);
    expect(computeRulerTicks(Number.NaN, 'mm')).toEqual([]);
  });
});
