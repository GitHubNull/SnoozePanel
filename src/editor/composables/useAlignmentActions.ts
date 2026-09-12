/**
 * 对齐 / 分布动作：把 core/align 纯函数的位移结果写回各组件 layout。
 *
 * 量测口径与拖拽/缩放一致：在画布内按 [data-comp-key] .component-content 取可见内容盒，
 * 换算为画布百分比外接框，交给 alignDeltas/distributeDeltas 求中心位移，再夹取写回 layout.x/y。
 * 约束：对齐需 ≥2 选中，分布需 ≥3 选中。
 */
import { computed, type ComputedRef } from 'vue';
import { alignDeltas, distributeDeltas, type AlignKind, type DistributeAxis, type Box } from '@/core/align';
import type { ComponentSelection } from './useComponentSelection';

/** 对齐 / 分布动作组合式函数返回值 */
export interface AlignmentActions {
  /** 是否可执行对齐（≥2 选中） */
  canAlign: ComputedRef<boolean>;
  /** 是否可执行分布（≥3 选中） */
  canDistribute: ComputedRef<boolean>;
  /** 按对齐方式对齐选中组件 */
  align: (kind: AlignKind) => void;
  /** 按轴向平均分布选中组件 */
  distribute: (axis: DistributeAxis) => void;
}

const clampPos = (v: number): number => Math.min(100, Math.max(0, v));

export function useAlignmentActions(
  selection: ComponentSelection,
  getCanvasEl: () => HTMLElement | null,
): AlignmentActions {
  const canAlign = computed(() => selection.selectedKeys.value.length >= 2);
  const canDistribute = computed(() => selection.selectedKeys.value.length >= 3);

  /** 在画布内按可见内容盒量测选中组件的外接框（画布百分比） */
  function measure(keys: string[]): { key: string; box: Box }[] {
    const canvas = getCanvasEl();
    if (!canvas) return [];
    const cr = canvas.getBoundingClientRect();
    if (cr.width <= 0 || cr.height <= 0) return [];
    const out: { key: string; box: Box }[] = [];
    for (const key of keys) {
      const content = canvas.querySelector(`[data-comp-key="${key}"] .component-content`) as HTMLElement | null;
      if (!content) continue;
      const r = content.getBoundingClientRect();
      out.push({
        key,
        box: {
          left: ((r.left - cr.left) / cr.width) * 100,
          top: ((r.top - cr.top) / cr.height) * 100,
          right: ((r.right - cr.left) / cr.width) * 100,
          bottom: ((r.bottom - cr.top) / cr.height) * 100,
        },
      });
    }
    return out;
  }

  /** 把位移写回各组件 layout.x/y（夹取 0-100） */
  function applyDeltas(
    measured: { key: string; box: Box }[],
    deltas: { dx: number; dy: number }[],
  ): void {
    measured.forEach((m, i) => {
      const layout = selection.layoutByKey(m.key);
      if (!layout) return;
      const d = deltas[i];
      selection.setLayoutByKey(m.key, {
        x: clampPos(layout.x + d.dx),
        y: clampPos(layout.y + d.dy),
      });
    });
  }

  function align(kind: AlignKind): void {
    if (!canAlign.value) return;
    const measured = measure(selection.selectedKeys.value);
    if (measured.length < 2) return;
    applyDeltas(measured, alignDeltas(measured.map((m) => m.box), kind));
  }

  function distribute(axis: DistributeAxis): void {
    if (!canDistribute.value) return;
    const measured = measure(selection.selectedKeys.value);
    if (measured.length < 3) return;
    applyDeltas(measured, distributeDeltas(measured.map((m) => m.box), axis));
  }

  return { canAlign, canDistribute, align, distribute };
}
