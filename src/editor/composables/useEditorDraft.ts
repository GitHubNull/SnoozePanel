/**
 * 编辑器本地草稿与对外变更桥接。
 *
 * 设计约束：
 *   - 本地草稿是编辑器内所有编辑的单一数据源，任何字段变更后整体 emit（深拷贝避免引用污染）；
 *   - 回声防护：HA 侧把 config-changed 的结果回填给 setConfig 时，props.config 变化 → 同步草稿
 *     → 草稿深度 watcher 触发 → 若不拦截会再次 emit，形成 emit → setConfig → emit 的无限循环。
 *     同步期间置位标记，待草稿 watcher 本轮执行完毕（nextTick）后复位；
 *   - 对外 emit 做 300ms 防抖，避免输入过程中频繁触发 config-changed。
 *
 * 另向历史记录暴露 isSyncing()：props 回填引起草稿同步的同一 flush 内均为 true，
 * 供 useEditorHistory 区分「用户编辑」与「HA 回声回填」，避免生成幽灵历史步。
 */
import { nextTick, reactive, watch } from 'vue';
import type { SnoozeConfig } from '@/core/types';

/** 供桥接读取配置的 props 最小面 */
interface DraftBridgeProps {
  config: SnoozeConfig;
}

/** useEditorDraft 返回值 */
export interface EditorDraftBridge {
  /** 本地编辑草稿（reactive，编辑器内唯一数据源） */
  draft: SnoozeConfig;
  /** 当前是否处于 props 回填同步窗口（true 时草稿变更非用户编辑） */
  isSyncing: () => boolean;
}

/**
 * 创建编辑草稿与变更桥接。
 * @param props 组件 props（至少含 config）
 * @param emit 组件 emit（仅使用 'change'）
 */
export function useEditorDraft(
  props: DraftBridgeProps,
  emit: (event: 'change', config: SnoozeConfig) => void,
): EditorDraftBridge {
  // 本地草稿，任何字段变更后整体 emit（深拷贝避免引用污染）
  const draft = reactive<SnoozeConfig>(JSON.parse(JSON.stringify(props.config)) as SnoozeConfig);

  /** 回声防护标记：props 回填期间为 true，草稿 watcher 据此跳过对外 emit */
  let syncingFromProps = false;

  watch(
    () => props.config,
    (next) => {
      syncingFromProps = true;
      Object.assign(draft, JSON.parse(JSON.stringify(next)) as SnoozeConfig);
      void nextTick(() => {
        syncingFromProps = false;
      });
    },
    { deep: true },
  );

  let emitTimer: ReturnType<typeof setTimeout> | null = null;
  watch(
    draft,
    () => {
      // 仅 props 回填引起的同步不对外 emit
      if (syncingFromProps) return;
      // 防抖 300ms，避免输入过程中频繁触发 config-changed
      if (emitTimer !== null) clearTimeout(emitTimer);
      emitTimer = setTimeout(() => {
        emit('change', JSON.parse(JSON.stringify(draft)) as SnoozeConfig);
      }, 300);
    },
    { deep: true },
  );

  return { draft, isSyncing: () => syncingFromProps };
}
