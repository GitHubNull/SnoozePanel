/**
 * 编辑器草稿的历史记录（撤销 / 恢复）。
 *
 * 设计要点：
 *   - 以「快照 + 基线」维护历史：baseline 表示最近一次已提交的状态，past / future 为前后快照栈；
 *   - 用户编辑经 300ms 防抖后提交一步（与 useEditorDraft 的对外 emit 防抖一致），
 *     把拖拽 / 连续输入合并为单步，避免每个字符都产生一步；
 *   - 两类非用户变更被隔离，不计入历史：
 *       1) undo/redo 自身写回（applying 守卫）；
 *       2) HA 回声回填（isSyncing() 为 true，仅重设基线，不推栈）；
 *   - 撤销 / 恢复以 Object.assign 就地写回 reactive 草稿，天然触发对外 config-changed。
 */
import { computed, nextTick, ref, watch, type ComputedRef } from 'vue';
import type { SnoozeConfig } from '@/core/types';

/** 历史栈上限（超出丢弃最旧快照） */
const MAX_HISTORY = 50;

/** 历史记录组合式函数返回值 */
export interface EditorHistory {
  /** 是否可撤销 */
  canUndo: ComputedRef<boolean>;
  /** 是否可恢复 */
  canRedo: ComputedRef<boolean>;
  /** 撤销一步 */
  undo: () => void;
  /** 恢复一步 */
  redo: () => void;
}

/**
 * 创建草稿历史记录。
 * @param draft 编辑草稿（reactive，与 useEditorDraft 同源）
 * @param isSyncing 读取「是否处于 props 回填同步窗口」的函数（来自 useEditorDraft）
 */
export function useEditorHistory(
  draft: SnoozeConfig,
  isSyncing: () => boolean,
): EditorHistory {
  /** 撤销栈（存快照，栈顶为最近一步之前的状态） */
  const past = ref<string[]>([]);
  /** 恢复栈 */
  const future = ref<string[]>([]);
  /** 最近一次已提交状态快照 */
  let baseline = JSON.stringify(draft);
  /** 守卫：undo/redo 自身写回期间为 true，避免把写回误记为新的历史步 */
  let applying = false;
  let commitTimer: ReturnType<typeof setTimeout> | null = null;

  const canUndo = computed(() => past.value.length > 0);
  const canRedo = computed(() => future.value.length > 0);

  /** 取消待提交的防抖计时 */
  function cancelCommit(): void {
    if (commitTimer !== null) {
      clearTimeout(commitTimer);
      commitTimer = null;
    }
  }

  /** 防抖提交一步：把基线压入撤销栈，清空恢复栈，基线推进到当前 */
  function scheduleCommit(): void {
    cancelCommit();
    commitTimer = setTimeout(() => {
      commitTimer = null;
      const current = JSON.stringify(draft);
      if (current === baseline) return;
      past.value.push(baseline);
      if (past.value.length > MAX_HISTORY) past.value.shift();
      future.value = [];
      baseline = current;
    }, 300);
  }

  watch(
    draft,
    () => {
      // 自身写回：不计入历史
      if (applying) return;
      // HA 回声回填：重设基线，不推栈
      if (isSyncing()) {
        cancelCommit();
        baseline = JSON.stringify(draft);
        return;
      }
      scheduleCommit();
    },
    { deep: true },
  );

  /** 应用快照到草稿（就写回 reactive，触发对外 emit） */
  function applySnapshot(snapshot: string): void {
    applying = true;
    Object.assign(draft, JSON.parse(snapshot) as SnoozeConfig);
    baseline = snapshot;
    void nextTick(() => {
      applying = false;
    });
  }

  function undo(): void {
    if (past.value.length === 0) return;
    cancelCommit();
    future.value.push(baseline);
    const snapshot = past.value.pop() as string;
    applySnapshot(snapshot);
  }

  function redo(): void {
    if (future.value.length === 0) return;
    cancelCommit();
    past.value.push(baseline);
    const snapshot = future.value.pop() as string;
    applySnapshot(snapshot);
  }

  return { canUndo, canRedo, undo, redo };
}
