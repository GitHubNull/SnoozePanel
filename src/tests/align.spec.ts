import { describe, it, expect } from 'vitest';
import { alignDeltas, distributeDeltas, screenAlignDeltas, SCREEN_CENTER, type Box } from '../core/align';

/** 便捷构造外接框（画布百分比） */
function box(left: number, top: number, right: number, bottom: number): Box {
  return { left, top, right, bottom };
}

describe('alignDeltas 对齐位移', () => {
  // A 中心(15,15)，B 中心(40,50)；选区外接框 left=10 right=50 top=10 bottom=60 → 中心(30,35)
  const boxes = [box(10, 10, 20, 20), box(30, 40, 50, 60)];

  it('左对齐：所有左缘对齐到最左边界', () => {
    expect(alignDeltas(boxes, 'left')).toEqual([
      { dx: 0, dy: 0 },
      { dx: -20, dy: 0 },
    ]);
  });

  it('右对齐：所有右缘对齐到最右边界', () => {
    expect(alignDeltas(boxes, 'right')).toEqual([
      { dx: 30, dy: 0 },
      { dx: 0, dy: 0 },
    ]);
  });

  it('水平居中：所有中心对齐到选区中心 X', () => {
    expect(alignDeltas(boxes, 'hcenter')).toEqual([
      { dx: 15, dy: 0 },
      { dx: -10, dy: 0 },
    ]);
  });

  it('顶端对齐：所有上缘对齐到最上边界', () => {
    expect(alignDeltas(boxes, 'top')).toEqual([
      { dx: 0, dy: 0 },
      { dx: 0, dy: -30 },
    ]);
  });

  it('底端对齐：所有下缘对齐到最下边界', () => {
    expect(alignDeltas(boxes, 'bottom')).toEqual([
      { dx: 0, dy: 40 },
      { dx: 0, dy: 0 },
    ]);
  });

  it('垂直居中：所有中心对齐到选区中心 Y', () => {
    expect(alignDeltas(boxes, 'vcenter')).toEqual([
      { dx: 0, dy: 20 },
      { dx: 0, dy: -15 },
    ]);
  });

  it('少于 2 个组件返回全零位移', () => {
    expect(alignDeltas([box(1, 2, 3, 4)], 'left')).toEqual([{ dx: 0, dy: 0 }]);
    expect(alignDeltas([], 'right')).toEqual([]);
  });
});

describe('distributeDeltas 平均分布', () => {
  // 中心 X：A=5、B=55、C=35（输入顺序 A,B,C）；排序后 A(5) C(35) B(55)
  const boxes = [box(0, 0, 10, 10), box(50, 0, 60, 10), box(30, 0, 40, 10)];

  it('水平平均分布：首尾不动，中间等间距', () => {
    // 目标间距 = (55-5)/2 = 25 → C 目标中心 30，位移 -5
    expect(distributeDeltas(boxes, 'horizontal')).toEqual([
      { dx: 0, dy: 0 },
      { dx: 0, dy: 0 },
      { dx: -5, dy: 0 },
    ]);
  });

  it('垂直平均分布：首尾不动，中间等间距', () => {
    // 中心 Y：A=5、B=55、C=35，同上逻辑 → C 位移 -5
    const vb = [box(0, 0, 10, 10), box(0, 50, 10, 60), box(0, 30, 10, 40)];
    expect(distributeDeltas(vb, 'vertical')).toEqual([
      { dx: 0, dy: 0 },
      { dx: 0, dy: 0 },
      { dx: 0, dy: -5 },
    ]);
  });

  it('少于 3 个组件返回全零位移', () => {
    expect(distributeDeltas(boxes.slice(0, 2), 'horizontal')).toEqual([
      { dx: 0, dy: 0 },
      { dx: 0, dy: 0 },
    ]);
    expect(distributeDeltas([], 'vertical')).toEqual([]);
  });
});

describe('screenAlignDeltas 对齐到屏幕中心', () => {
  it('center：外接框中心移到屏幕中心 (50,50)', () => {
    // 单组件中心 (30,20) → 位移 (20,30)
    expect(screenAlignDeltas([box(20, 10, 40, 30)], 'center')).toEqual({ dx: 20, dy: 30 });
  });

  it('hcenter：仅水平位移（dy=0）', () => {
    expect(screenAlignDeltas([box(20, 10, 40, 30)], 'hcenter')).toEqual({ dx: 20, dy: 0 });
  });

  it('vcenter：仅垂直位移（dx=0）', () => {
    expect(screenAlignDeltas([box(20, 10, 40, 30)], 'vcenter')).toEqual({ dx: 0, dy: 30 });
  });

  it('多组件按选区外接框中心整体位移', () => {
    // A (10,10,20,20) B (30,40,50,60) → 外接框 (10,10,50,60) 中心 (30,35)
    expect(screenAlignDeltas([box(10, 10, 20, 20), box(30, 40, 50, 60)], 'center')).toEqual({
      dx: 20,
      dy: 15,
    });
  });

  it('空数组返回零位移', () => {
    expect(screenAlignDeltas([], 'center')).toEqual({ dx: 0, dy: 0 });
  });

  it('屏幕中心基准为 50%', () => {
    expect(SCREEN_CENTER).toBe(50);
  });
});
