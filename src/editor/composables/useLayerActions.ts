/**
 * 图层动作：对当前主选中组件执行置顶 / 置底 / 上移 / 下移，写回全部组件 layout.z。
 *
 * 汇总所有组件 key 与当前 z（缺省按组件清单索引），交给 core/layers 的 reorderLayers
 * 得到 key→z（0..n-1）映射，再逐个写回 layout.z；渲染层按 z 升序堆叠。
 */
import { reorderLayers, type LayerOp } from '@/core/layers';
import type { ComponentSelection } from './useComponentSelection';

/** 图层动作组合式函数返回值 */
export interface LayerActions {
  /** 对主选中组件执行图层操作 */
  applyLayer: (op: LayerOp) => void;
}

export function useLayerActions(selection: ComponentSelection): LayerActions {
  function applyLayer(op: LayerOp): void {
    const target = selection.selectedComponent.value;
    if (!target) return;
    const items = selection.componentList.value.map((c, i) => {
      const layout = selection.layoutByKey(c.key);
      return { key: c.key, z: layout?.z ?? i };
    });
    const map = reorderLayers(items, target, op);
    for (const [key, z] of Object.entries(map)) {
      selection.setLayoutByKey(key, { z });
    }
  }

  return { applyLayer };
}
