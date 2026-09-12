import { describe, it, expect } from 'vitest';
import { computeResize } from '../runtime/drag';
import { baseWidthFor } from '../core/types';

describe('computeResize 独立轴向缩放（lockAspect=false）', () => {
  it('无位移时保持原尺寸', () => {
    expect(computeResize(40, 0, 0, 0, 1000, 500)).toEqual({ w: 40, h: 0 });
  });

  it('宽高各自按轴向位移换算百分比', () => {
    // dx=100 → +10%（rectW=1000）；dy=50 → +10%（rectH=500）
    expect(computeResize(40, 20, 100, 50, 1000, 500)).toEqual({ w: 50, h: 30 });
  });

  it('宽高裁剪到 [5, 100]', () => {
    expect(computeResize(90, 0, 500, 0, 1000, 500).w).toBe(100);
    expect(computeResize(6, 0, -500, 0, 1000, 500).w).toBe(5);
  });
});

describe('computeResize 等比缩放（lockAspect=true）', () => {
  it('水平位移驱动统一比例，高度自适应时 h 保持 0', () => {
    // rx=0.2 占优 → factor=1.2 → 40*1.2=48
    expect(computeResize(40, 0, 200, 0, 1000, 500, true)).toEqual({ w: 48, h: 0 });
  });

  it('垂直位移同样可驱动统一比例（任意方向拖拽均可缩放）', () => {
    // ry=0.2 占优 → factor=1.2 → 40*1.2=48
    expect(computeResize(40, 0, 0, 100, 1000, 500, true)).toEqual({ w: 48, h: 0 });
  });

  it('取绝对值更大的轴换算比例（斜向拖拽）', () => {
    // rx=0.1, ry=0.3 → 取 ry → factor=1.3 → 40*1.3=52
    expect(computeResize(40, 0, 100, 150, 1000, 500, true).w).toBeCloseTo(52, 5);
  });

  it('已有的宽高按同一比例同步缩放', () => {
    // ry=0.5 → factor=1.5 → w=60, h=75
    expect(computeResize(40, 50, 0, 250, 1000, 500, true)).toEqual({ w: 60, h: 75 });
  });

  it('向内拖拽等比缩小', () => {
    // rx=-0.2 → factor=0.8 → 40*0.8=32
    expect(computeResize(40, 0, -200, 0, 1000, 500, true)).toEqual({ w: 32, h: 0 });
  });

  it('缩放结果同样裁剪到 [5, 100]', () => {
    // rx=2 → factor=3 → 40*3=120 → 裁剪到 100
    expect(computeResize(40, 0, 2000, 0, 1000, 500, true).w).toBe(100);
    // factor=0 → 裁剪到 5
    expect(computeResize(40, 0, -1000, 0, 1000, 500, true).w).toBe(5);
  });
});

describe('computeResize 边界防护', () => {
  it('容器尺寸为 0 时不产生 NaN/Infinity', () => {
    const r = computeResize(40, 0, 100, 100, 0, 0);
    expect(Number.isFinite(r.w)).toBe(true);
    expect(Number.isFinite(r.h)).toBe(true);
  });
});

describe('baseWidthFor 缩放基准宽度', () => {
  it('按组件键返回默认基准宽度', () => {
    expect(baseWidthFor('clock')).toBe(60);
    expect(baseWidthFor('calendar')).toBe(40);
    expect(baseWidthFor('lunar')).toBe(30);
    expect(baseWidthFor('weather')).toBe(25);
  });

  it('自定义文本按 text 基准', () => {
    expect(baseWidthFor('text_0')).toBe(30);
    expect(baseWidthFor('text_3')).toBe(30);
  });

  it('未知组件键回退 50', () => {
    expect(baseWidthFor('unknown')).toBe(50);
  });
});
