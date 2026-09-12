<script setup lang="ts">
/**
 * 编辑器五区之四：组件属性编辑器（右，可拖宽 / 收起 / 恢复默认宽度）。
 *
 * 按选中组件渲染时钟 / 日历 / 农历 / 天气 / 单条文本属性、通用布局（X/Y/宽/高）
 * 与字体颜色；时钟另有表盘选择卡片（点击进入表盘市场）。
 * 编辑草稿与选中态经 provide/inject 获取（共享 reactive，就地写回）；仅面板开合等
 * 纯 UI 动作经 emit 回传 EditorApp。
 */
import { listFaceOptions } from '@/ui/faces/registry';
import FacePreview from '@/ui/components/FacePreview.vue';
import { injectEditorDraft, injectEditorSelection } from '../editorContext';
import Button from 'primevue/button';
import ToggleSwitch from 'primevue/toggleswitch';
import InputNumber from 'primevue/inputnumber';
import InputText from 'primevue/inputtext';
import Select from 'primevue/select';
import ColorPicker from 'primevue/colorpicker';

defineProps<{
  /** 天气实体候选项（weather.*） */
  weatherEntities: string[];
  /** 是否收起（滑轨态） */
  collapsed: boolean;
  /** 展开态宽度（px） */
  width: number;
}>();

const emit = defineEmits<{
  (e: 'open-marketplace'): void;
  (e: 'toggle-panel'): void;
  (e: 'restore-width'): void;
  (e: 'resize-start', ev: PointerEvent): void;
}>();

// 编辑草稿与选中态经 provide/inject 下发：共享 reactive，子组件就地写回，
// 既避免逐字段 emit 的样板，也规避「修改 prop」。
const draft = injectEditorDraft();
const {
  selectedComponent,
  selectedLabel,
  currentLayout,
  currentColor,
  selectedTextIndex,
  selectedTextContent,
  selectedTextShow,
  setCurrentColor,
  removeSelectedText,
} = injectEditorSelection();

// 表盘选项：从注册表动态生成（label 中文名，value 表盘 id）
const CLOCK_STYLES = listFaceOptions().map((f) => ({ label: f.label, value: f.id }));

/** 表盘 id → 中文名 */
function faceLabel(id: string): string {
  return CLOCK_STYLES.find((f) => f.value === id)?.label ?? id;
}

function onOpenMarketplace(): void {
  emit('open-marketplace');
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
  <aside class="plugin-props" :class="{ collapsed }" :style="{ width: width + 'px' }">
    <template v-if="!collapsed">
      <span
        class="resizer"
        role="separator"
        aria-orientation="vertical"
        aria-label="拖拽调整组件属性区宽度"
        @pointerdown="onResizeStart"
      ></span>
      <div class="panel-head">
        <span class="panel-title">组件属性</span>
        <span class="panel-head-actions">
          <Button
            icon="pi pi-undo"
            size="small"
            text
            rounded
            title="恢复默认宽度"
            aria-label="恢复属性区默认宽度"
            @click="onRestoreWidth"
          />
          <Button
            icon="pi pi-angle-double-right"
            size="small"
            text
            rounded
            title="收起"
            aria-label="收起组件属性区"
            @click="onTogglePanel"
          />
        </span>
      </div>
      <div class="panel-scroll">
        <div class="props-subject">{{ selectedLabel }}</div>

        <!-- 时钟属性：表盘卡片 + 时间显示 -->
        <template v-if="selectedComponent === 'clock'">
          <div class="face-selector-card" @click="onOpenMarketplace">
            <div class="face-selector-preview">
              <FacePreview
                :face-id="draft.components.clock.style"
                :theme="draft.theme"
                :seconds="draft.components.clock.seconds"
                :hour24="draft.components.clock.hour24"
                :zoom="1.2"
              />
            </div>
            <div class="face-selector-info">
              <span class="face-selector-name">{{ faceLabel(draft.components.clock.style) }}</span>
              <span class="face-selector-action">点击进入表盘市场</span>
            </div>
          </div>
          <div class="inline-row"><label>24 小时制</label><ToggleSwitch v-model="draft.components.clock.hour24" /></div>
          <div class="inline-row"><label>显示秒</label><ToggleSwitch v-model="draft.components.clock.seconds" /></div>
        </template>

        <!-- 日历属性 -->
        <template v-if="selectedComponent === 'calendar'">
          <div class="field">
            <label>周起始日</label>
            <Select
              v-model="draft.components.calendar.week_start"
              :options="[{ label: '周一', value: 1 }, { label: '周日', value: 0 }]"
              option-label="label"
              option-value="value"
              class="w-full"
            />
          </div>
          <div class="field">
            <label>日期格式模板</label>
            <InputText v-model="draft.components.calendar.format" class="w-full" placeholder="M月D日 dddd" />
            <small>占位符：YYYY 年 / M 月 / D 日 / dddd 星期</small>
          </div>
          <div class="inline-row"><label>显示周数</label><ToggleSwitch v-model="draft.components.calendar.show_week_number" /></div>
        </template>

        <!-- 农历属性 -->
        <template v-if="selectedComponent === 'lunar'">
          <div class="field">
            <label>格式模板</label>
            <InputText v-model="draft.components.lunar.format" class="w-full" placeholder="{lunar_month}{lunar_day}" />
            <small>占位符：{'{lunar_month}'} 月 / {'{lunar_day}'} 日 / {'{ganzhi}'} 干支 / {'{zodiac}'} 生肖</small>
          </div>
        </template>

        <!-- 天气属性 -->
        <template v-if="selectedComponent === 'weather'">
          <div class="field">
            <label>天气实体</label>
            <Select
              v-model="draft.components.weather.entity"
              :options="weatherEntities"
              editable
              class="w-full"
              placeholder="weather.home"
            />
          </div>
        </template>

        <!-- 单条自定义文本属性（在组件分类中选中某条文本时） -->
        <template v-if="selectedTextIndex >= 0">
          <div class="field">
            <label>文本内容</label>
            <InputText
              v-model="selectedTextContent"
              class="w-full"
              placeholder="文本内容，可含 {entity_id} 占位符"
            />
            <small>支持实体占位符，如 室温 {'{sensor.temp}'}°C</small>
          </div>
          <div class="inline-row"><label>显示该条文本</label><ToggleSwitch v-model="selectedTextShow" /></div>
          <div class="field">
            <Button label="删除此文本" icon="pi pi-trash" severity="danger" size="small" text @click="removeSelectedText" />
          </div>
        </template>

        <!-- 通用：布局编辑（X/Y/宽/高） -->
        <div class="layout-section">
          <label class="layout-label">布局</label>
          <div class="layout-inputs">
            <div class="layout-input">
              <span>X</span>
              <InputNumber v-model="currentLayout.x" :min="0" :max="100" suffix="%" />
            </div>
            <div class="layout-input">
              <span>Y</span>
              <InputNumber v-model="currentLayout.y" :min="0" :max="100" suffix="%" />
            </div>
            <div class="layout-input">
              <span>宽</span>
              <InputNumber v-model="currentLayout.w" :min="5" :max="100" suffix="%" />
            </div>
            <div class="layout-input">
              <span>高</span>
              <InputNumber v-model="currentLayout.h" :min="0" :max="100" suffix="%" placeholder="自适应" />
            </div>
          </div>
          <small class="layout-hint">拖拽画布中组件可移动位置，拖拽右下角圆形手柄可等比缩放；开启磁吸时会自动对齐网格。</small>
        </div>

        <!-- 通用：字体颜色 -->
        <div class="field">
          <label>字体颜色（可选）</label>
          <div class="color-row">
            <ColorPicker
              :model-value="currentColor"
              format="hex"
              @update:model-value="setCurrentColor(String($event ?? ''))"
            />
            <InputText
              :model-value="currentColor"
              placeholder="留空用主题色"
              class="color-input"
              @update:model-value="setCurrentColor(String($event ?? ''))"
            />
            <Button v-if="currentColor" label="清除" size="small" text @click="setCurrentColor('')" />
          </div>
        </div>
      </div>
    </template>

    <!-- 收起态：竖向滑轨 -->
    <button v-else type="button" class="rail" title="展开组件属性区" aria-label="展开组件属性区" @click="onTogglePanel">
      <span class="rail-label">组件属性</span>
    </button>
  </aside>
</template>

<style scoped src="../editor.css"></style>
<style scoped>
/* ---- 4. 组件属性编辑器（右） ---- */
.plugin-props {
  display: flex;
  flex-direction: column;
  flex: none;
  min-height: 0;
  position: relative;
  border-left: 1px solid var(--sp-chrome-border, #494e52);
  background: var(--sp-chrome-bg, #33373a);
  transition: width 0.12s ease;
}
.plugin-props.collapsed {
  width: 36px;
}
.props-subject {
  font-size: 13px;
  font-weight: 700;
  color: var(--primary-color, #5ea0ff);
  margin-bottom: 12px;
}

/* 属性区拖拽条贴左边缘外扩 */
.resizer {
  left: -3px;
}

/* 表盘选择器卡片 */
.face-selector-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px;
  margin-bottom: 12px;
  border: 1px solid var(--sp-chrome-border, #494e52);
  border-radius: 10px;
  background: var(--sp-chrome-bg-2, #3f4448);
  cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.face-selector-card:hover {
  border-color: var(--primary-color, #5ea0ff);
  box-shadow: 0 0 0 3px rgba(94, 160, 255, 0.12);
}
.face-selector-preview {
  width: 120px;
  height: 72px;
  flex: none;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--sp-chrome-border, #494e52);
  background: #000;
}
.face-selector-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}
.face-selector-name {
  font-size: 14px;
  font-weight: 600;
}
.face-selector-action {
  font-size: 12px;
  color: var(--primary-color, #5ea0ff);
}

/* 布局编辑 */
.layout-section {
  margin-bottom: 16px;
}
.layout-label {
  display: block;
  font-weight: 600;
  font-size: 13px;
  margin-bottom: 8px;
  color: var(--sp-chrome-text-dim, #98a0a6);
}
.layout-inputs {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}
.layout-hint {
  display: block;
  margin-top: 8px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--sp-chrome-text-dim, #98a0a6);
}
.layout-input {
  display: flex;
  align-items: center;
  gap: 6px;
}
.layout-input span {
  font-size: 12px;
  color: var(--sp-chrome-text-dim, #98a0a6);
  flex: none;
  min-width: 16px;
}
.layout-input :deep(.p-inputnumber) {
  flex: 1;
}
.layout-input :deep(.p-inputnumber-input) {
  width: 100%;
  font-size: 13px;
}

/* 颜色选择 */
.color-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.color-input {
  flex: 1;
  font-family: monospace;
  font-size: 13px;
}
</style>
