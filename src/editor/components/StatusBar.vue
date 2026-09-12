<script setup lang="ts">
/**
 * 编辑器五区之五：插件状态栏（底）。
 *
 * 左：设备 id；中：选中对象与网格档位提示；右：保存 / 同步状态。
 * 纯展示组件，无内部状态，全部数据由 EditorApp 传入。
 */
defineProps<{
  /** 当前设备 id */
  deviceId: string;
  /** 中段提示（选中对象 + 网格档位） */
  hint: string;
  /** 右侧状态（文案 + 语义类 ok / warn） */
  state: { text: string; cls: string };
}>();
</script>

<template>
  <footer class="plugin-status">
    <span class="status-item">设备 {{ deviceId }}</span>
    <span class="status-item status-hint">{{ hint }}</span>
    <span class="status-item" :class="state.cls">{{ state.text }}</span>
  </footer>
</template>

<style scoped>
/* ============ 5. 插件状态栏（底） ============ */
.plugin-status {
  display: flex;
  align-items: center;
  gap: 16px;
  flex: none;
  height: 30px;
  padding: 0 12px;
  border-top: 1px solid var(--sp-chrome-border, #494e52);
  background: var(--sp-chrome-bg, #33373a);
  font-size: 12px;
  color: var(--sp-chrome-text-dim, #98a0a6);
}
.status-hint {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: center;
}
.status-item.ok {
  color: var(--primary-color, #5ea0ff);
}
.status-item.warn {
  color: #e0a23c;
}
</style>
