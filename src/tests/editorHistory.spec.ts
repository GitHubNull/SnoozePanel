import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { nextTick, reactive } from 'vue';
import { useEditorHistory } from '../editor/composables/useEditorHistory';
import { DEFAULT_CONFIG, type SnoozeConfig } from '../core/types';

/** 深拷贝默认配置作为可编辑草稿 */
function makeDraft(): SnoozeConfig {
  return reactive(JSON.parse(JSON.stringify(DEFAULT_CONFIG)) as SnoozeConfig);
}

/** 提交一步：刷新深度 watcher 后推进 300ms 防抖 */
async function commit(): Promise<void> {
  await nextTick();
  vi.advanceTimersByTime(300);
}

describe('useEditorHistory 撤销 / 恢复', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('初始不可撤销 / 恢复', () => {
    const h = useEditorHistory(makeDraft(), () => false);
    expect(h.canUndo.value).toBe(false);
    expect(h.canRedo.value).toBe(false);
  });

  it('一次编辑经 300ms 防抖后产生一步历史', async () => {
    const draft = makeDraft();
    const h = useEditorHistory(draft, () => false);
    draft.idle_seconds = 120;
    await nextTick();
    // 防抖未到，尚未入栈
    expect(h.canUndo.value).toBe(false);
    vi.advanceTimersByTime(300);
    expect(h.canUndo.value).toBe(true);
  });

  it('undo 还原、redo 再应用', async () => {
    const draft = makeDraft();
    const h = useEditorHistory(draft, () => false);
    const before = draft.idle_seconds;
    draft.idle_seconds = 120;
    await commit();
    expect(h.canUndo.value).toBe(true);

    h.undo();
    await nextTick();
    expect(draft.idle_seconds).toBe(before);
    expect(h.canRedo.value).toBe(true);

    h.redo();
    await nextTick();
    expect(draft.idle_seconds).toBe(120);
  });

  it('连续两次编辑产生两步历史', async () => {
    const draft = makeDraft();
    const h = useEditorHistory(draft, () => false);
    draft.idle_seconds = 120;
    await commit();
    draft.idle_seconds = 180;
    await commit();

    h.undo();
    await nextTick();
    expect(draft.idle_seconds).toBe(120);
    expect(h.canUndo.value).toBe(true);

    h.undo();
    await nextTick();
    expect(draft.idle_seconds).toBe(DEFAULT_CONFIG.idle_seconds);
    expect(h.canUndo.value).toBe(false);
  });

  it('新编辑清空恢复栈', async () => {
    const draft = makeDraft();
    const h = useEditorHistory(draft, () => false);
    draft.idle_seconds = 120;
    await commit();

    h.undo();
    await nextTick();
    expect(h.canRedo.value).toBe(true);

    draft.idle_seconds = 200;
    await commit();
    expect(h.canRedo.value).toBe(false);
  });

  it('HA 回声（isSyncing=true）不计入历史', async () => {
    const draft = makeDraft();
    let syncing = false;
    const h = useEditorHistory(draft, () => syncing);
    syncing = true;
    draft.idle_seconds = 120;
    await commit();
    expect(h.canUndo.value).toBe(false);
  });

  it('历史步数上限 50', async () => {
    const draft = makeDraft();
    const h = useEditorHistory(draft, () => false);
    for (let i = 0; i < 60; i++) {
      draft.idle_seconds = 10 + i;
      await commit();
    }
    let steps = 0;
    while (h.canUndo.value && steps < 100) {
      h.undo();
      await nextTick();
      steps++;
    }
    expect(steps).toBe(50);
  });
});
