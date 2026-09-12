<script setup lang="ts">
/**
 * 编辑器五区之三：屏保效果阅览与位置尺寸编辑区（中）。
 *
 * 顶部工具条（网格显示 / 磁吸 / 网格尺寸预设 + 数字 + 恢复默认）+ 编辑态 ScreensaverApp。
 * 网格偏好经 provide/inject 获取（EditorApp 持有），步长经 emit 回传；
 * 画布内拖拽 / 点选经 ScreensaverApp 事件透传给 EditorApp，由其写回草稿与选中态。
 */
import type { SnoozeConfig, ComponentLayout } from '@/core/types';
import { injectEditorLayout } from '../editorContext';
import Button from 'primevue/button';
import ToggleSwitch from 'primevue/toggleswitch';
import Select from 'primevue/select';
import InputNumber from 'primevue/inputnumber';
import ScreensaverApp from '@/ui/ScreensaverApp.vue';

defineProps<{
  /** 编辑草稿（画布按此渲染） */
  config: SnoozeConfig;
  /** 预览画布设备 id（展示用） */
  deviceId: string;
  /** 画布网格只读快照（供 ScreensaverApp 的网格层与磁吸） */
  grid: { show: boolean; snap: boolean; step: number };
  /** 当前选中组件 key */
  selected: string;
  /** 网格步长（%） */
  gridStep: number;
  /** 网格尺寸预设档位 */
  gridPresets: { label: string; value: number }[];
}>();

// 编辑器 UI 偏好经 provide/inject 下发：共享 reactive，直接读写 grid.show / grid.snap
const uiLayout = injectEditorLayout();

const emit = defineEmits<{
  (e: 'update:gridStep', value: number): void;
  (e: 'reset-grid'): void;
  (e: 'update:layout', compKey: string, layout: ComponentLayout): void;
  (e: 'select', compKey: string): void;
}>();

/** 网格步长变更（预设下拉 / 数字输入共用） */
function onGridStepChange(value: unknown): void {
  emit('update:gridStep', Number(value ?? 0));
}
function onResetGrid(): void {
  emit('reset-grid');
}
function onLayoutUpdate(compKey: string, layout: ComponentLayout): void {
  emit('update:layout', compKey, layout);
}
function onSelect(compKey: string): void {
  emit('select', compKey);
}
</script>

<template>
  <main class="plugin-canvas">
    <div class="canvas-bar">
      <label class="canvas-toggle">
        <ToggleSwitch v-model="uiLayout.grid.show" />
        <span>网格</span>
      </label>
      <label class="canvas-toggle">
        <ToggleSwitch v-model="uiLayout.grid.snap" />
        <span>磁吸</span>
      </label>
      <span class="canvas-sep"></span>
      <span class="canvas-label">网格尺寸</span>
      <Select
        :model-value="gridStep"
        :options="gridPresets"
        option-label="label"
        option-value="value"
        size="small"
        class="grid-preset"
        aria-label="网格尺寸预设"
        @update:model-value="onGridStepChange"
      />
      <InputNumber
        :model-value="gridStep"
        :min="1"
        :max="20"
        :step="0.5"
        :show-buttons="true"
        suffix="%"
        size="small"
        class="grid-number"
        aria-label="网格尺寸百分比"
        @update:model-value="onGridStepChange"
      />
      <Button label="恢复默认" size="small" text @click="onResetGrid" />
    </div>

    <ScreensaverApp
      :config="config"
      :device-id="deviceId"
      :grid="grid"
      :selected="selected"
      edit-mode
      @update:layout="onLayoutUpdate"
      @select="onSelect"
    />
  </main>
</template>

<style scoped>
/* ---- 3. 屏保效果阅览与位置尺寸编辑区（中） ---- */
.plugin-canvas {
  position: relative;
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: #000;
}
.canvas-bar {
  position: absolute;
  top: 10px;
  left: 10px;
  z-index: 30;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-radius: 10px;
  background: rgba(20, 24, 34, 0.82);
  color: #e6ebf5;
  backdrop-filter: blur(6px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.28);
}
.canvas-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  white-space: nowrap;
}
.canvas-sep {
  width: 1px;
  height: 18px;
  background: rgba(255, 255, 255, 0.18);
}
.canvas-label {
  font-size: 12px;
  opacity: 0.85;
  white-space: nowrap;
}
.grid-preset {
  width: 84px;
}
.grid-number {
  width: 116px;
}
</style>
