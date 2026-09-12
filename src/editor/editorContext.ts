/**
 * 编辑器子组件与 EditorApp 之间的共享上下文注入键。
 *
 * 编辑器的三份共享可变状态——「编辑草稿 / UI 偏好 / 选中态」——需要在五区子组件内
 * 就近读写。若逐层以 props 下发，子组件写回会被 vue/no-mutating-props 判定为修改 prop；
 * 若逐字段 emit 回传又会引入大量样板。故统一以 provide/inject 下发：
 *   - EditorApp 作为唯一数据源提供三份 reactive；
 *   - 各区子组件按需注入后直接读写（对象/ref 就地写回，天然保持响应式）。
 * 这些上下文仅在编辑器内部使用；脱离 EditorApp 单独挂载会因缺少 provide 而报错。
 */
import { inject, type InjectionKey } from 'vue';
import type { SnoozeConfig } from '@/core/types';
import type { EditorLayoutState } from './useEditorLayout';
import type { ComponentSelection } from './composables/useComponentSelection';
import type { AlignmentActions } from './composables/useAlignmentActions';
import type { LayerActions } from './composables/useLayerActions';

/** 编辑草稿（共享 reactive，编辑器内所有编辑的单一数据源） */
export const EditorDraftKey: InjectionKey<SnoozeConfig> = Symbol('snooze-editor-draft');
/** 编辑器 UI 偏好（面板宽度 / 收起态 / 画布网格，共享 reactive） */
export const EditorLayoutKey: InjectionKey<EditorLayoutState> = Symbol('snooze-editor-layout');
/** 选中组件状态与派生数据（含 currentLayout / currentColor / 文本读写） */
export const EditorSelectionKey: InjectionKey<ComponentSelection> = Symbol('snooze-editor-selection');
/** 顶部工具条动作（对齐 / 分布 / 图层） */
export const EditorActionsKey: InjectionKey<EditorActions> = Symbol('snooze-editor-actions');

/** 顶部工具条聚合动作 */
export interface EditorActions {
  /** 对齐 / 分布动作 */
  alignment: AlignmentActions;
  /** 图层动作 */
  layers: LayerActions;
}

/** 注入编辑草稿（未提供时抛错，显式暴露使用位置问题） */
export function injectEditorDraft(): SnoozeConfig {
  const v = inject(EditorDraftKey);
  if (!v) throw new Error('[SnoozePanel] 缺少编辑器草稿上下文（需在 EditorApp 内使用）');
  return v;
}

/** 注入编辑器 UI 偏好 */
export function injectEditorLayout(): EditorLayoutState {
  const v = inject(EditorLayoutKey);
  if (!v) throw new Error('[SnoozePanel] 缺少编辑器布局上下文（需在 EditorApp 内使用）');
  return v;
}

/** 注入选中组件状态与派生数据 */
export function injectEditorSelection(): ComponentSelection {
  const v = inject(EditorSelectionKey);
  if (!v) throw new Error('[SnoozePanel] 缺少编辑器选中上下文（需在 EditorApp 内使用）');
  return v;
}

/** 注入顶部工具条动作（对齐 / 分布 / 图层） */
export function injectEditorActions(): EditorActions {
  const v = inject(EditorActionsKey);
  if (!v) throw new Error('[SnoozePanel] 缺少编辑器动作上下文（需在 EditorApp 内使用）');
  return v;
}
