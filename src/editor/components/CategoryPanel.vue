<script setup lang="ts">
/**
 * 编辑器五区之二：组件分类选择区（左，可拖宽 / 收起 / 恢复默认宽度）。
 *
 * 列出四类固定组件与每条自定义文本（各带显隐开关），点击选中并与画布/属性区联动。
 * 宽度、收起态来自 useEditorLayout（EditorApp 持有），交互经 emit 回传，本组件无内部状态。
 */
import Button from 'primevue/button';
import ToggleSwitch from 'primevue/toggleswitch';

/** 组件清单单项 */
interface ComponentListItem {
  key: string;
  label: string;
  show: boolean;
  toggleable: boolean;
}

defineProps<{
  /** 组件分类清单（四类固定组件 + 每条自定义文本各成一项） */
  components: ComponentListItem[];
  /** 当前选中组件 key */
  selected: string;
  /** 是否收起（滑轨态） */
  collapsed: boolean;
  /** 展开态宽度（px） */
  width: number;
}>();

const emit = defineEmits<{
  (e: 'select', key: string): void;
  (e: 'toggle-show', key: string, value: boolean): void;
  (e: 'add-text'): void;
  (e: 'toggle-panel'): void;
  (e: 'restore-width'): void;
  (e: 'resize-start', ev: PointerEvent): void;
}>();

function onToggleShow(key: string, value: boolean): void {
  emit('toggle-show', key, value);
}
function onAddText(): void {
  emit('add-text');
}
function onTogglePanel(): void {
  emit('toggle-panel');
}
function onRestoreWidth(): void {
  emit('restore-width');
}
function onResizeStart(ev: PointerEvent): void {
  emit('resize-start', ev);
}
</script>

<template>
  <aside class="plugin-cats" :class="{ collapsed }" :style="{ width: width + 'px' }">
    <template v-if="!collapsed">
      <div class="panel-head">
        <span class="panel-title">组件分类</span>
        <span class="panel-head-actions">
          <Button
            icon="pi pi-undo"
            size="small"
            text
            rounded
            title="恢复默认宽度"
            aria-label="恢复分类区默认宽度"
            @click="onRestoreWidth"
          />
          <Button
            icon="pi pi-angle-double-left"
            size="small"
            text
            rounded
            title="收起"
            aria-label="收起组件分类区"
            @click="onTogglePanel"
          />
        </span>
      </div>
      <div class="panel-scroll">
        <div class="component-list">
          <div
            v-for="comp in components"
            :key="comp.key"
            class="component-item"
            :class="{ active: selected === comp.key }"
            @click="emit('select', comp.key)"
          >
            <ToggleSwitch
              :model-value="comp.show"
              @update:model-value="onToggleShow(comp.key, $event)"
              @click.stop
            />
            <span class="component-name">{{ comp.label }}</span>
          </div>
        </div>
        <Button
          class="add-text"
          label="添加自定义文本"
          icon="pi pi-plus"
          size="small"
          text
          @click="onAddText"
        />
      </div>
      <!-- 右边缘拖拽条：调整分类区宽度 -->
      <span
        class="resizer"
        role="separator"
        aria-orientation="vertical"
        aria-label="拖拽调整组件分类区宽度"
        @pointerdown="onResizeStart"
      ></span>
    </template>

    <!-- 收起态：竖向滑轨 -->
    <button v-else type="button" class="rail" title="展开组件分类区" aria-label="展开组件分类区" @click="onTogglePanel">
      <span class="rail-label">组件分类</span>
    </button>
  </aside>
</template>

<style scoped src="../editor.css"></style>
<style scoped>
/* ---- 2. 组件分类选择区（左） ---- */
.plugin-cats {
  display: flex;
  flex-direction: column;
  flex: none;
  min-height: 0;
  position: relative;
  border-right: 1px solid var(--divider-color, #e0e0e0);
  background: var(--card-background-color, #fff);
  transition: width 0.12s ease;
}
.plugin-cats.collapsed {
  width: 36px;
}
.add-text {
  margin-top: 10px;
  width: 100%;
  justify-content: flex-start;
}

/* 组件列表 */
.component-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.component-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s;
}
.component-item:hover {
  background: var(--card-background-color, #f5f5f5);
}
.component-item.active {
  background: var(--primary-color, #5ea0ff);
  color: #fff;
}
.component-item.active :deep(.p-toggleswitch) {
  filter: brightness(10);
}
.component-name {
  font-size: 14px;
  font-weight: 500;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 分类区拖拽条贴右边缘外扩 */
.resizer {
  right: -3px;
}
</style>
