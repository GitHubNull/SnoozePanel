/**
 * 拖拽与缩放手势封装（纯 DOM，无 Vue 依赖）。
 *
 * 供 ComponentWrapper 在编辑态下使用：
 *   - makeDraggable：按住组件本体拖动，实时回调百分比坐标
 *   - makeResizable：按住右下角缩放手柄拖动，实时回调百分比尺寸
 *   - snapEdges：把组件边缘吸附到网格线（磁吸附对齐，纯函数，供调用方组合）
 *
 * 坐标/尺寸均为相对父容器的百分比（0-100），与 ComponentLayout 对齐。
 * 手势只负责报告原始坐标/尺寸，不内置吸附；吸附由调用方基于「可见内容边缘」
 * 用 snapEdges 完成（吸附在裁剪之后执行，故不会因吸附而越界）。
 * 支持触摸（touch-action: none 由调用方 CSS 保证）。
 */

export interface DragCallbacks {
  /** 手势开始回调（可用于在此刻量测几何，如组件可见边缘半宽/半高） */
  onStart?(): void;
  /** 拖动中实时回调（百分比坐标） */
  onMove(x: number, y: number): void;
  /** 拖动结束回调（百分比坐标） */
  onEnd?(x: number, y: number): void;
}

export interface ResizeCallbacks {
  /** 手势开始回调（可用于在此刻量测几何） */
  onStart?(): void;
  /** 缩放中实时回调（百分比尺寸） */
  onResize(w: number, h: number): void;
  /** 缩放结束回调（百分比尺寸） */
  onEnd?(w: number, h: number): void;
}

/** 清理函数 */
export type Cleanup = () => void;

/**
 * 使元素可拖拽。
 * @param el 目标元素（position: absolute，left/top 百分比定位）
 * @param container 父容器（用于计算百分比）
 * @param cb 回调（onStart 在手势开始时触发，供调用方量测几何）
 * @returns 清理函数
 */
export function makeDraggable(el: HTMLElement, container: HTMLElement, cb: DragCallbacks): Cleanup {
  let startX = 0;
  let startY = 0;
  let startLeft = 0;
  let startTop = 0;
  let dragging = false;

  const onPointerDown = (ev: PointerEvent): void => {
    if (ev.button !== 0) return; // 仅左键/单指
    dragging = true;
    el.setPointerCapture(ev.pointerId);
    startX = ev.clientX;
    startY = ev.clientY;
    // 从当前样式读取百分比（非计算像素，避免缩放误差累积）
    startLeft = parseFloat(el.style.left) || 0;
    startTop = parseFloat(el.style.top) || 0;
    cb.onStart?.();
    ev.preventDefault();
  };

  const onPointerMove = (ev: PointerEvent): void => {
    if (!dragging) return;
    const rect = container.getBoundingClientRect();
    const dx = ev.clientX - startX;
    const dy = ev.clientY - startY;
    const x = startLeft + (dx / rect.width) * 100;
    const y = startTop + (dy / rect.height) * 100;
    cb.onMove(clamp(x, 0, 100), clamp(y, 0, 100));
  };

  const onPointerUp = (ev: PointerEvent): void => {
    if (!dragging) return;
    dragging = false;
    el.releasePointerCapture(ev.pointerId);
    const rect = container.getBoundingClientRect();
    const dx = ev.clientX - startX;
    const dy = ev.clientY - startY;
    const x = startLeft + (dx / rect.width) * 100;
    const y = startTop + (dy / rect.height) * 100;
    cb.onEnd?.(clamp(x, 0, 100), clamp(y, 0, 100));
  };

  el.addEventListener('pointerdown', onPointerDown);
  el.addEventListener('pointermove', onPointerMove);
  el.addEventListener('pointerup', onPointerUp);
  el.addEventListener('pointercancel', onPointerUp);

  return () => {
    el.removeEventListener('pointerdown', onPointerDown);
    el.removeEventListener('pointermove', onPointerMove);
    el.removeEventListener('pointerup', onPointerUp);
    el.removeEventListener('pointercancel', onPointerUp);
  };
}

/**
 * 使元素可通过右下角手柄缩放。
 * @param handle 缩放手柄元素（小方块，绝对定位于组件右下角）
 * @param el 目标元素（position: absolute，width/height 百分比）
 * @param container 父容器
 * @param cb 回调
 * @param lockAspect 等比模式：取水平/垂直位移中更大的一轴换算统一比例，宽高同步缩放
 *                   （适合时钟等固定比例的组件）；默认 false 时宽高按各自轴向独立调整。
 * @returns 清理函数
 */
export function makeResizable(
  handle: HTMLElement,
  el: HTMLElement,
  container: HTMLElement,
  cb: ResizeCallbacks,
  lockAspect = false,
): Cleanup {
  let startX = 0;
  let startY = 0;
  let startW = 0;
  let startH = 0;
  let resizing = false;

  const onPointerDown = (ev: PointerEvent): void => {
    if (ev.button !== 0) return;
    resizing = true;
    handle.setPointerCapture(ev.pointerId);
    startX = ev.clientX;
    startY = ev.clientY;
    startW = parseFloat(el.style.width) || 0;
    startH = parseFloat(el.style.height) || 0;
    cb.onStart?.();
    ev.preventDefault();
    ev.stopPropagation(); // 阻止触发组件拖拽
  };

  const onPointerMove = (ev: PointerEvent): void => {
    if (!resizing) return;
    const rect = container.getBoundingClientRect();
    const size = computeResize(
      startW, startH, ev.clientX - startX, ev.clientY - startY, rect.width, rect.height, lockAspect,
    );
    cb.onResize(size.w, size.h);
  };

  const onPointerUp = (ev: PointerEvent): void => {
    if (!resizing) return;
    resizing = false;
    handle.releasePointerCapture(ev.pointerId);
    const rect = container.getBoundingClientRect();
    const size = computeResize(
      startW, startH, ev.clientX - startX, ev.clientY - startY, rect.width, rect.height, lockAspect,
    );
    cb.onEnd?.(size.w, size.h);
  };

  handle.addEventListener('pointerdown', onPointerDown);
  handle.addEventListener('pointermove', onPointerMove);
  handle.addEventListener('pointerup', onPointerUp);
  handle.addEventListener('pointercancel', onPointerUp);

  return () => {
    handle.removeEventListener('pointerdown', onPointerDown);
    handle.removeEventListener('pointermove', onPointerMove);
    handle.removeEventListener('pointerup', onPointerUp);
    handle.removeEventListener('pointercancel', onPointerUp);
  };
}

/**
 * 纯函数：根据拖拽位移（像素）计算缩放后的宽高（百分比），便于单测。
 * - lockAspect=true：等比缩放，取水平/垂直位移中更大的一轴换算统一比例。
 * - lockAspect=false：宽高分别按各自轴向位移独立调整。
 * 两种模式下 startH≤0（高度自适应）时均返回 h=0，调用方应保持高度自适应；
 * 宽度与非自适应的高度统一裁剪到 [5, 100]。
 * @param startW 起始宽度百分比
 * @param startH 起始高度百分比（0 表示高度自适应）
 * @param dx 水平位移像素
 * @param dy 垂直位移像素
 * @param rectW 容器宽度像素
 * @param rectH 容器高度像素
 * @param lockAspect 是否等比缩放
 */
export function computeResize(
  startW: number,
  startH: number,
  dx: number,
  dy: number,
  rectW: number,
  rectH: number,
  lockAspect = false,
): { w: number; h: number } {
  const safeW = rectW > 0 ? rectW : 1;
  const safeH = rectH > 0 ? rectH : 1;
  if (lockAspect) {
    const rx = dx / safeW;
    const ry = dy / safeH;
    const r = Math.abs(rx) >= Math.abs(ry) ? rx : ry;
    const factor = 1 + r;
    return {
      w: clamp(startW * factor, 5, 100),
      h: startH > 0 ? clamp(startH * factor, 5, 100) : 0,
    };
  }
  const w = clamp(startW + (dx / safeW) * 100, 5, 100);
  // 高度自适应（startH≤0）时保持 h=0，不因缩放而强制写入高度
  const h = startH > 0 ? clamp(startH + (dy / safeH) * 100, 5, 100) : 0;
  return { w, h };
}

/**
 * 纯函数：把组件的一组候选边缘（%）吸附到最近的网格线（磁吸附对齐）。
 * 仅当某条边缘距某条网格线 <= threshold 时才命中「吸附」——返回使该边缘精确对齐
 * 网格线所需的位移 delta 与命中的网格线位置 line；无命中的边缘一律不吸附，
 * 返回 { delta: 0, line: null }（拖拽时即体现为自由移动、且不显示参考线）。
 * 这样参考线只会出现在组件边缘「快到」网格线时，而不是无脑常显。
 * step<=0 或 threshold<=0（或非法）时始终不吸附。
 * @param edges 候选边缘位置（%，如组件的左缘与右缘）
 * @param step 网格步长（%）
 * @param threshold 吸附触发阈值（%）；须小于 step/2，网格之间才会留有不吸附的自由区
 */
export function snapEdges(
  edges: number[],
  step: number,
  threshold: number,
): { delta: number; line: number | null } {
  if (!(step > 0) || !(threshold > 0)) return { delta: 0, line: null };
  let best: { delta: number; line: number; dist: number } | null = null;
  for (const edge of edges) {
    if (!Number.isFinite(edge)) continue;
    const line = Math.round(edge / step) * step;
    const dist = Math.abs(edge - line);
    if (dist <= threshold && (!best || dist < best.dist)) {
      best = { delta: line - edge, line, dist };
    }
  }
  return best ? { delta: best.delta, line: best.line } : { delta: 0, line: null };
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}
