<script setup lang="ts">
/**
 * 编辑器五区之四：组件属性编辑器（右，可拖宽 / 收起 / 恢复默认宽度）。
 *
 * 主体为「元数据驱动」：选中组件后从其 schema（face.meta / widget.meta / 类型级默认）
 * 动态渲染属性控件（PropertySchemaForm），读写经 useComponentSelection 的
 * readField / writeField（自动区分 bind:'option'/'field'）。
 * 另保留通用「布局」「字体颜色」两区，以及表盘 / 样式选择卡片（点击进入市场）。
 * 编辑草稿与选中态经 provide/inject 获取（共享 reactive，就地写回）；仅面板开合等
 * 纯 UI 动作经 emit 回传 EditorApp。
 */
import { computed } from 'vue';
import { facesVersion, getFace } from '@/ui/faces/registry';
import { listWidgetStyleOptions, widgetsVersion } from '@/ui/widgets/registry';
import FacePreview from '@/ui/components/FacePreview.vue';
import WidgetPreview from '@/ui/components/WidgetPreview.vue';
import { injectEditorDraft, injectEditorSelection } from '../editorContext';
import PropertySchemaForm from '../forms/PropertySchemaForm.vue';
import Button from 'primevue/button';
import InputNumber from 'primevue/inputnumber';
import InputText from 'primevue/inputtext';
import ColorPicker from 'primevue/colorpicker';

const props = defineProps<{
  /** 天气实体候选项（weather.*） */
  weatherEntities: string[];
  /** 是否收起（滑轨态） */
  collapsed: boolean;
  /** 展开态宽度（px） */
  width: number;
}>();

const emit = defineEmits<{
  (e: 'open-marketplace'): void;
  (e: 'open-widget-marketplace'): void;
  (e: 'toggle-panel'): void;
  (e: 'restore-width'): void;
  (e: 'resize-start', ev: PointerEvent): void;
}>();

// 编辑草稿与选中态经 provide/inject 下发：共享 reactive，子组件就地写回，
// 既避免逐字段 emit 的样板，也规避「修改 prop」。
const draft = injectEditorDraft();
const {
  selectedComponent,
  selectedCount,
  selectedLabel,
  currentLayout,
  currentColor,
  currentWidgetType,
  currentStyle,
  currentSchema,
  readField,
  writeField,
  selectedTextIndex,
  setCurrentColor,
  removeSelectedText,
} = injectEditorSelection();

/** 表盘 id → 中文名；未注册时与渲染层一致回退默认表盘名（依赖 facesVersion 响应运行时增删） */
function faceLabel(id: string): string {
  void facesVersion.value;
  return getFace(id).label;
}

/** 当前内容组件样式的中文名（用于样式选择卡片）；依赖 widgetsVersion 响应运行时增删 */
const currentWidgetStyleLabel = computed(() => {
  void widgetsVersion.value;
  const t = currentWidgetType.value;
  if (!t) return '';
  return listWidgetStyleOptions(t).find((s) => s.style === currentStyle.value)?.label ?? currentStyle.value;
});

/** 文本字段候选：天气实体（供 schema 中 entity 字段渲染为可编辑下拉） */
const fieldSuggestions = computed<Record<string, string[]>>(() => ({ entity: props.weatherEntities }));

function onOpenMarketplace(): void {
  emit('open-marketplace');
}
function onOpenWidgetMarketplace(): void {
  emit('open-widget-marketplace');
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

        <!-- 多选提示：属性面板主体针对「最后选中项」，其余选中项仅供对齐/图层操作 -->
        <div v-if="selectedCount > 1" class="multi-hint">
          已选 {{ selectedCount }} 项 · 当前编辑「{{ selectedLabel }}」，其余可用于对齐 / 图层
        </div>

        <!-- 表盘选择卡片（点击进入表盘市场） -->
        <div v-if="selectedComponent === 'clock'" class="face-selector-card" @click="onOpenMarketplace">
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

        <!-- 内容组件样式选择卡片（点击进入样式选择） -->
        <div v-else-if="currentWidgetType" class="face-selector-card" @click="onOpenWidgetMarketplace">
          <div class="face-selector-preview">
            <WidgetPreview :type="currentWidgetType" :style="currentStyle" :theme="draft.theme" />
          </div>
          <div class="face-selector-info">
            <span class="face-selector-name">{{ currentWidgetStyleLabel }}</span>
            <span class="face-selector-action">点击进入样式选择</span>
          </div>
        </div>

        <!-- 元数据驱动属性表单 -->
        <PropertySchemaForm
          :schema="currentSchema"
          :read="readField"
          :write="writeField"
          :suggestions="fieldSuggestions"
        />

        <!-- 单条自定义文本：删除按钮（内容 / 显隐已由 schema 渲染） -->
        <div v-if="selectedTextIndex >= 0" class="field">
          <Button label="删除此文本" icon="pi pi-trash" severity="danger" size="small" text @click="removeSelectedText" />
        </div>

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

/* 多选提示条 */
.multi-hint {
  margin-bottom: 12px;
  padding: 8px 10px;
  border-radius: 8px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--sp-chrome-text, #d8dcdf);
  background: color-mix(in srgb, var(--primary-color, #5ea0ff) 14%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--primary-color, #5ea0ff) 40%, transparent);
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
