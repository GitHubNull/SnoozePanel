/**
 * 对齐 / 分布纯函数（无 DOM、无副作用，可单测）。
 *
 * 坐标口径：全部为画布百分比（0-100），与 ComponentLayout 一致。
 * 每个组件用一个「外接矩形」Box 描述（left/top/right/bottom），
 * 由渲染层按可见内容盒量测后传入；对齐/分布结果以「中心位移 delta」形式返回，
 * 调用方把 delta 叠加回各组件 layout.x/y，即可完成对齐。
 *
 * 基准规则：
 *   - 对齐：以「选区外接框」为基准（左对齐对齐到最左边界，右对齐对齐到最右边界，依此类推）。
 *   - 分布：首尾两个组件保持不动，中间组件在首尾之间等间距排布。
 */

/** 组件外接矩形（画布百分比） */
export interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** 对齐方式：左 / 水平居中 / 右 / 顶 / 垂直居中 / 底 */
export type AlignKind = 'left' | 'hcenter' | 'right' | 'top' | 'vcenter' | 'bottom';

/** 分布轴向：水平 / 垂直 */
export type DistributeAxis = 'horizontal' | 'vertical';

/** 屏幕居中对齐方式：水平 / 垂直 / 双向 */
export type ScreenAlignKind = 'hcenter' | 'vcenter' | 'center';

/** 画布中心坐标（%）：屏幕对齐的统一基准 */
export const SCREEN_CENTER = 50;

/** 中心位移（画布百分比） */
export interface Delta {
  dx: number;
  dy: number;
}

const ZERO: Delta = { dx: 0, dy: 0 };

/** Box 中心 X */
function centerX(b: Box): number {
  return (b.left + b.right) / 2;
}

/** Box 中心 Y */
function centerY(b: Box): number {
  return (b.top + b.bottom) / 2;
}

/**
 * 以选区外接框为基准，计算每个组件的中心位移。
 * boxes.length < 2 时返回全零（无法对齐）。
 * 返回数组与输入 boxes 顺序一一对应。
 */
export function alignDeltas(boxes: Box[], kind: AlignKind): Delta[] {
  if (boxes.length < 2) return boxes.map(() => ({ ...ZERO }));

  const left = Math.min(...boxes.map((b) => b.left));
  const right = Math.max(...boxes.map((b) => b.right));
  const top = Math.min(...boxes.map((b) => b.top));
  const bottom = Math.max(...boxes.map((b) => b.bottom));
  const cx = (left + right) / 2;
  const cy = (top + bottom) / 2;

  return boxes.map((b) => {
    switch (kind) {
      case 'left':
        return { dx: left - b.left, dy: 0 };
      case 'right':
        return { dx: right - b.right, dy: 0 };
      case 'hcenter':
        return { dx: cx - centerX(b), dy: 0 };
      case 'top':
        return { dx: 0, dy: top - b.top };
      case 'bottom':
        return { dx: 0, dy: bottom - b.bottom };
      case 'vcenter':
        return { dx: 0, dy: cy - centerY(b) };
      default:
        return { ...ZERO };
    }
  });
}

/**
 * 水平 / 垂直平均分布：首尾组件保持不动，中间组件在首尾之间等间距排布。
 * 按中心坐标排序确定首尾；boxes.length < 3 时返回全零。
 * 返回数组与输入 boxes 顺序一一对应。
 */
export function distributeDeltas(boxes: Box[], axis: DistributeAxis): Delta[] {
  const n = boxes.length;
  if (n < 3) return boxes.map(() => ({ ...ZERO }));

  const centers = boxes.map((b) => (axis === 'horizontal' ? centerX(b) : centerY(b)));
  // 排序索引：确定首尾组件的固定中心与各组件等间距目标
  const order = centers.map((_, i) => i).sort((a, b) => centers[a] - centers[b]);
  const firstC = centers[order[0]];
  const lastC = centers[order[n - 1]];
  const step = (lastC - firstC) / (n - 1);

  const out: Delta[] = boxes.map(() => ({ ...ZERO }));
  for (let rank = 0; rank < n; rank++) {
    const idx = order[rank];
    // 首尾（rank 0 / n-1）不动，中间按 rank 等间距重排
    if (rank === 0 || rank === n - 1) continue;
    const target = firstC + step * rank;
    const delta = target - centers[idx];
    out[idx] = axis === 'horizontal' ? { dx: delta, dy: 0 } : { dx: 0, dy: delta };
  }
  return out;
}

/**
 * 以「屏幕中心」为基准，计算选区整体位移：把选区外接框的中心移到屏幕中心。
 * 与 alignDeltas（选区基准）不同，本函数返回单一共享位移，选区各组件同步平移，保持相对布局。
 * - hcenter：仅水平居中（dx 有效，dy=0）；
 * - vcenter：仅垂直居中（dy 有效，dx=0）；
 * - center：双向居中。
 * boxes 为空时返回零位移。
 */
export function screenAlignDeltas(boxes: Box[], kind: ScreenAlignKind): Delta {
  if (boxes.length === 0) return { ...ZERO };

  const left = Math.min(...boxes.map((b) => b.left));
  const right = Math.max(...boxes.map((b) => b.right));
  const top = Math.min(...boxes.map((b) => b.top));
  const bottom = Math.max(...boxes.map((b) => b.bottom));
  const cx = (left + right) / 2;
  const cy = (top + bottom) / 2;

  return {
    dx: kind === 'vcenter' ? 0 : SCREEN_CENTER - cx,
    dy: kind === 'hcenter' ? 0 : SCREEN_CENTER - cy,
  };
}
