/**
 * 编辑器快捷键：编辑器挂载期间绑定 keydown，映射到对齐 / 分布 / 图层动作。
 *
 *   Alt+L 左对齐   Alt+C 水平居中   Alt+R 右对齐
 *   Alt+T 顶端对齐 Alt+M 垂直居中   Alt+B 底端对齐
 *   Alt+H 水平平均分布  Alt+V 垂直平均分布
 *   Ctrl+] 置于顶层  Ctrl+[ 置于底层  Ctrl+Shift+] 上移一层  Ctrl+Shift+[ 下移一层
 *
 * 在输入框 / 可编辑元素内不触发，避免与表单输入冲突；命中时阻止浏览器默认行为。
 */
import { onBeforeUnmount, onMounted } from 'vue';
import type { AlignKind, DistributeAxis } from '@/core/align';
import type { LayerOp } from '@/core/layers';
import type { AlignmentActions } from './useAlignmentActions';
import type { LayerActions } from './useLayerActions';

const ALIGN_KEYS: Record<string, AlignKind> = {
  l: 'left',
  c: 'hcenter',
  r: 'right',
  t: 'top',
  m: 'vcenter',
  b: 'bottom',
};
const DISTRIBUTE_KEYS: Record<string, DistributeAxis> = {
  h: 'horizontal',
  v: 'vertical',
};

/** 是否聚焦在可编辑元素（输入框 / 文本域 / 下拉 / contenteditable）内 */
function isEditableTarget(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  if (!el || !el.tagName) return false;
  const tag = el.tagName.toUpperCase();
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

export function useEditorShortcuts(
  alignment: AlignmentActions,
  layers: LayerActions,
): void {
  function onKeydown(e: KeyboardEvent): void {
    if (isEditableTarget(e.target)) return;
    const key = e.key.toLowerCase();

    // Alt 单功能键：对齐 / 分布
    if (e.altKey && !e.ctrlKey && !e.metaKey) {
      if (key in ALIGN_KEYS) {
        e.preventDefault();
        alignment.align(ALIGN_KEYS[key]);
        return;
      }
      if (key in DISTRIBUTE_KEYS) {
        e.preventDefault();
        alignment.distribute(DISTRIBUTE_KEYS[key]);
      }
      return;
    }

    // Ctrl/Cmd + [ ]：图层（Shift 组合为上移/下移）
    if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.key === ']' || e.key === '[')) {
      e.preventDefault();
      const op: LayerOp = e.key === ']'
        ? (e.shiftKey ? 'forward' : 'front')
        : (e.shiftKey ? 'backward' : 'back');
      layers.applyLayer(op);
    }
  }

  onMounted(() => window.addEventListener('keydown', onKeydown));
  onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown));
}
