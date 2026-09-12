<script setup lang="ts">
/**
 * 编辑器五区之三：屏保效果阅览与位置尺寸编辑区（中）。
 *
 * 组合「浮动工具条 CanvasToolbar」（网格 / 屏幕尺寸 / 缩放适配）
 * 与「独立模拟设备面板 DevicePreview」（按目标屏幕尺寸渲染屏保并等比缩放适配）。
 * 网格偏好经 provide/inject 获取（EditorApp 持有），步长经 emit 回传；
 * 屏幕尺寸写入草稿（随配置持久化）；缩放档位来自 UI 偏好（透传给 DevicePreview 受控渲染）；
 * 画布内拖拽 / 点选经 DevicePreview 透传给 EditorApp。
 */
import type { SnoozeConfig, ComponentLayout } from '@/core/types';
import { injectEditorLayout, injectEditorDraft } from '../editorContext';
import CanvasToolbar from './CanvasToolbar.vue';
import DevicePreview from '@/ui/components/DevicePreview.vue';

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

// 编辑器 UI 偏好经 provide/inject 下发：读取缩放档位透传给 DevicePreview（受控）
const uiLayout = injectEditorLayout();
// 编辑草稿经 provide/inject 下发：屏幕尺寸随配置持久化，就地读写 draft.screen
const draft = injectEditorDraft();

const emit = defineEmits<{
  (e: 'update:gridStep', value: number): void;
  (e: 'reset-grid'): void;
  (e: 'update:layout', compKey: string, layout: ComponentLayout): void;
  (e: 'select', compKey: string): void;
}>();

function onLayoutUpdate(compKey: string, layout: ComponentLayout): void {
  emit('update:layout', compKey, layout);
}
function onSelect(compKey: string): void {
  emit('select', compKey);
}
</script>

<template>
  <main class="plugin-canvas">
    <!-- 浮动工具条：网格 / 屏幕尺寸 / 缩放适配（可收起 / 横竖 / 拖动停靠四边） -->
    <CanvasToolbar
      :grid-step="gridStep"
      :grid-presets="gridPresets"
      @update:grid-step="emit('update:gridStep', $event)"
      @reset-grid="emit('reset-grid')"
    />

    <!-- 独立模拟设备面板：缩放受控于工具条（受控模式隐藏内置「适配」按钮） -->
    <DevicePreview
      :config="config"
      :device-id="deviceId"
      :screen="draft.screen"
      :grid="grid"
      :selected="selected"
      :zoom-mode="uiLayout.zoom.mode"
      :zoom-percent="uiLayout.zoom.percent"
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
</style>
