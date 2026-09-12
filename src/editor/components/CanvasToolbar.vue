<script setup lang="ts">
/**
 * 编辑器画布浮动工具条：网格 / 屏幕尺寸 / 缩放适配三组控件 + 停靠 / 排列 / 收起交互。
 *
 * 支持停靠四边（上/右/下/左）、水平或垂直排列、可收起（默认收起），并可拖动改变停靠边。
 * 停靠边 / 排列方向 / 收起态 / 缩放档位均为 UI 偏好，就地写入注入的 uiLayout（随 localStorage 持久化）；
 * 网格步长与「恢复默认」经 emit 回传 EditorApp，保持既有单一数据源与裁剪逻辑。
 * 拖动落点采用「就近边缘吸附」：拖动时高亮候选边，释放后停靠到该边。
 */
import { computed, ref } from 'vue';
import Button from 'primevue/button';
import ToggleSwitch from 'primevue/toggleswitch';
import Select from 'primevue/select';
import InputNumber from 'primevue/inputnumber';
import { SCREEN_PRESETS, CUSTOM_PRESET_ID, presetById, matchPreset, clampScreenDim } from '@/core/screen';
import { injectEditorLayout, injectEditorDraft } from '../editorContext';
import { ZOOM_PRESETS, ZOOM_LIMITS, clampZoomPercent, type ToolbarEdge } from '../useEditorLayout';

defineProps<{
  /** 网格步长（%） */
  gridStep: number;
  /** 网格尺寸预设档位 */
  gridPresets: { label: string; value: number }[];
}>();

const emit = defineEmits<{
  (e: 'update:gridStep', value: number): void;
  (e: 'reset-grid'): void;
}>();

// UI 偏好经 provide/inject 下发：共享 reactive，就地读写 grid / toolbar / zoom
const ui = injectEditorLayout();
// 编辑草稿经 provide/inject 下发：屏幕尺寸随配置持久化，就地读写 draft.screen
const draft = injectEditorDraft();

// ---- 屏幕尺寸选择器 ----
/** 预设选项（SCREEN_PRESETS + 「自定义宽高」） */
const SCREEN_OPTIONS = [
  ...SCREEN_PRESETS.map((p) => ({ label: p.label, value: p.id })),
  { label: '自定义宽高', value: CUSTOM_PRESET_ID },
];

/** 当前屏幕尺寸预设（选预设即同步宽高；选自定义仅改 preset） */
const screenPreset = computed<string>({
  get: () => draft.screen.preset,
  set: (id) => {
    if (id !== CUSTOM_PRESET_ID) {
      const p = presetById(id);
      if (p) {
        draft.screen.preset = p.id;
        draft.screen.width = p.width;
        draft.screen.height = p.height;
      }
      return;
    }
    // 切到自定义：保留当前宽高，仅改 preset
    draft.screen.preset = CUSTOM_PRESET_ID;
  },
});

/** 写屏幕宽/高并按实际尺寸回正预设（命中预设则显示该预设，否则「自定义」） */
function updateScreenDim(axis: 'width' | 'height', value: unknown): void {
  const n = Number(value);
  if (!Number.isFinite(n)) return;
  if (axis === 'width') draft.screen.width = clampScreenDim(n, draft.screen.width);
  else draft.screen.height = clampScreenDim(n, draft.screen.height);
  draft.screen.preset = matchPreset(draft.screen.width, draft.screen.height);
}

/** 屏幕宽（设备 CSS px） */
const screenWidth = computed<number>({
  get: () => draft.screen.width,
  set: (v) => updateScreenDim('width', v),
});
/** 屏幕高（设备 CSS px） */
const screenHeight = computed<number>({
  get: () => draft.screen.height,
  set: (v) => updateScreenDim('height', v),
});

// ---- 网格步长（经 emit 回传 EditorApp 统一裁剪） ----
function onGridStepChange(value: unknown): void {
  emit('update:gridStep', Number(value ?? 0));
}

// ---- 缩放适配（适配 / 预设档位 / 自定义） ----
/** 缩放下拉选项：适配 + 百分比档位 + 自定义 */
const zoomOptions = [
  { label: '适配', value: 'fit' },
  ...ZOOM_PRESETS.map((p) => ({ label: `${p}%`, value: String(p) })),
  { label: '自定义', value: 'custom' },
];

/** 当前下拉值：fit / 预设百分比字符串 / custom（非预设档位视为自定义） */
const zoomSelectValue = computed<string>(() => {
  if (ui.zoom.mode === 'fit') return 'fit';
  return ZOOM_PRESETS.includes(ui.zoom.percent) ? String(ui.zoom.percent) : 'custom';
});

/** 下拉变更：适配切模式；预设写档位；自定义保留当前百分比并尝试收敛 */
function onZoomSelectChange(value: unknown): void {
  const val = String(value);
  if (val === 'fit') {
    ui.zoom.mode = 'fit';
    return;
  }
  ui.zoom.mode = 'percent';
  if (val !== 'custom') ui.zoom.percent = clampZoomPercent(Number(val));
}

/** 自定义缩放百分比（写入前统一裁剪到 [min, max]，恒 >0 且 <500） */
const zoomPercent = computed<number>({
  get: () => ui.zoom.percent,
  set: (v) => {
    ui.zoom.percent = clampZoomPercent(v);
  },
});

// ---- 停靠 / 排列 / 收起 ----
function toggleCollapse(): void {
  ui.toolbar.collapsed = !ui.toolbar.collapsed;
}
function toggleOrientation(): void {
  ui.toolbar.orientation = ui.toolbar.orientation === 'horizontal' ? 'vertical' : 'horizontal';
}

const rootEl = ref<HTMLElement | null>(null);
/** 是否拖动中（显示落点提示） */
const dragging = ref(false);
/** 拖动中的候选停靠边 */
const dragEdge = ref<ToolbarEdge | null>(null);

/** 取指针距离最近的画布边 */
function nearestEdge(rect: DOMRect, x: number, y: number): ToolbarEdge {
  const dTop = Math.abs(y - rect.top);
  const dBottom = Math.abs(rect.bottom - y);
  const dLeft = Math.abs(x - rect.left);
  const dRight = Math.abs(rect.right - x);
  const min = Math.min(dTop, dBottom, dLeft, dRight);
  if (min === dTop) return 'top';
  if (min === dBottom) return 'bottom';
  if (min === dLeft) return 'left';
  return 'right';
}

/** 拖动把手：pointer 期间跟踪候选边，释放后停靠（位移过小视为点击） */
function onDragStart(ev: PointerEvent): void {
  if (ev.button !== 0) return;
  const canvas = rootEl.value?.closest('.plugin-canvas') as HTMLElement | null;
  if (!canvas) return;
  ev.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const startX = ev.clientX;
  const startY = ev.clientY;
  dragging.value = true;
  dragEdge.value = ui.toolbar.edge;
  document.documentElement.classList.add('sp-toolbar-dragging');

  const onMove = (e: PointerEvent): void => {
    dragEdge.value = nearestEdge(rect, e.clientX, e.clientY);
  };
  const onUp = (e: PointerEvent): void => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);
    document.documentElement.classList.remove('sp-toolbar-dragging');
    dragging.value = false;
    const moved = Math.abs(e.clientX - startX) + Math.abs(e.clientY - startY);
    const edge = dragEdge.value;
    dragEdge.value = null;
    if (moved < 6 || !edge) return; // 位移过小视为点击，不改变停靠
    ui.toolbar.edge = edge;
    // 停靠左右边缘时默认改为竖向排列（仍可手动切回）
    if (edge === 'left' || edge === 'right') ui.toolbar.orientation = 'vertical';
  };

  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);
}
</script>

<template>
  <!-- 拖动落点提示：高亮候选停靠边（仅拖动中显示） -->
  <div v-if="dragging" class="tb-drop" :class="`edge-${dragEdge}`" aria-hidden="true"></div>

  <!-- 收起态：贴边的展开把手 -->
  <button
    v-if="ui.toolbar.collapsed"
    ref="rootEl"
    type="button"
    class="canvas-toolbar collapsed"
    :class="[`edge-${ui.toolbar.edge}`, `orient-${ui.toolbar.orientation}`]"
    title="展开工具条"
    aria-label="展开工具条"
    @click="toggleCollapse"
  >
    <span class="tb-handle-label">工具</span>
  </button>

  <!-- 展开态：工具条主体 -->
  <div
    v-else
    ref="rootEl"
    class="canvas-toolbar"
    :class="[`edge-${ui.toolbar.edge}`, `orient-${ui.toolbar.orientation}`]"
  >
    <!-- 操作簇：拖动把手 / 方向切换 / 收起（用文字标签，不依赖图标字体） -->
    <div class="tb-actions">
      <button
        type="button"
        class="tb-btn tb-grip"
        title="按住拖动，松手即停靠到最近的边缘"
        aria-label="拖动以停靠工具条"
        @pointerdown="onDragStart"
      >
        拖动
      </button>
      <button
        type="button"
        class="tb-btn"
        :title="ui.toolbar.orientation === 'horizontal' ? '切换为垂直排列' : '切换为水平排列'"
        aria-label="切换工具条排列方向"
        @click="toggleOrientation"
      >
        {{ ui.toolbar.orientation === 'horizontal' ? '转竖排' : '转横排' }}
      </button>
      <button type="button" class="tb-btn" title="收起工具条" aria-label="收起工具条" @click="toggleCollapse">
        收起
      </button>
    </div>
    <span class="tb-sep"></span>

    <!-- 网格 -->
    <label class="tb-toggle"><ToggleSwitch v-model="ui.grid.show" /><span>网格</span></label>
    <label class="tb-toggle"><ToggleSwitch v-model="ui.grid.snap" /><span>磁吸</span></label>
    <span class="tb-sep"></span>
    <span class="tb-label">网格尺寸</span>
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
    <Button label="恢复默认" size="small" text @click="emit('reset-grid')" />
    <span class="tb-sep"></span>

    <!-- 屏幕尺寸 -->
    <span class="tb-label">屏幕</span>
    <Select
      v-model="screenPreset"
      :options="SCREEN_OPTIONS"
      option-label="label"
      option-value="value"
      size="small"
      class="screen-preset"
      aria-label="屏幕尺寸预设"
    />
    <template v-if="draft.screen.preset === CUSTOM_PRESET_ID">
      <InputNumber
        v-model="screenWidth"
        :min="120"
        :max="4096"
        :use-grouping="false"
        size="small"
        class="screen-dim"
        aria-label="屏幕宽度"
      />
      <span class="tb-label">×</span>
      <InputNumber
        v-model="screenHeight"
        :min="120"
        :max="4096"
        :use-grouping="false"
        size="small"
        class="screen-dim"
        aria-label="屏幕高度"
      />
    </template>
    <span class="tb-sep"></span>

    <!-- 缩放适配 -->
    <span class="tb-label">缩放</span>
    <Select
      :model-value="zoomSelectValue"
      :options="zoomOptions"
      option-label="label"
      option-value="value"
      size="small"
      class="zoom-preset"
      aria-label="缩放适配比例"
      @update:model-value="onZoomSelectChange"
    />
    <InputNumber
      v-if="ui.zoom.mode === 'percent'"
      v-model="zoomPercent"
      :min="ZOOM_LIMITS.min"
      :max="ZOOM_LIMITS.max"
      :step="5"
      :show-buttons="true"
      suffix="%"
      size="small"
      class="zoom-number"
      aria-label="自定义缩放百分比"
    />
  </div>
</template>

<style scoped>
/* 拖动期间全局抓手光标，避免划过其它元素时光标跳动 */
:global(html.sp-toolbar-dragging) {
  cursor: grabbing !important;
  user-select: none;
}
:global(html.sp-toolbar-dragging) * {
  cursor: grabbing !important;
}

/* ---- 工具条主体 ---- */
.canvas-toolbar {
  position: absolute;
  z-index: 30;
  display: flex;
  gap: 8px;
  padding: 6px 10px;
  border-radius: 10px;
  background: rgba(20, 24, 34, 0.82);
  color: #e6ebf5;
  backdrop-filter: blur(6px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.28);
}
/* 展开态：按停靠边定位 */
.canvas-toolbar:not(.collapsed).edge-top { top: 10px; left: 10px; max-width: calc(100% - 20px); }
.canvas-toolbar:not(.collapsed).edge-bottom { bottom: 10px; left: 10px; max-width: calc(100% - 20px); }
.canvas-toolbar:not(.collapsed).edge-left { left: 10px; top: 10px; max-height: calc(100% - 20px); }
.canvas-toolbar:not(.collapsed).edge-right { right: 10px; top: 10px; max-height: calc(100% - 20px); }
/* 展开态：排列方向 */
.canvas-toolbar.orient-horizontal { flex-direction: row; align-items: center; flex-wrap: wrap; }
.canvas-toolbar.orient-vertical {
  flex-direction: column;
  align-items: flex-start;
  max-width: calc(100% - 20px);
  /* 竖排时控件按声明宽度收敛，禁止溢出产生横向滚动条 */
  overflow-x: hidden;
  overflow-y: auto;
}

/* ---- 收起态把手 ---- */
.canvas-toolbar.collapsed {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  font-size: 12px;
  cursor: pointer;
}
.canvas-toolbar.collapsed:hover { background: rgba(40, 48, 66, 0.9); }
.canvas-toolbar.collapsed.edge-top { top: 10px; right: 10px; }
.canvas-toolbar.collapsed.edge-bottom { bottom: 10px; right: 10px; }
.canvas-toolbar.collapsed.edge-left { left: 10px; top: 10px; }
.canvas-toolbar.collapsed.edge-right { right: 10px; top: 10px; }

/* ---- 拖动落点提示 ---- */
.tb-drop {
  position: absolute;
  z-index: 25;
  pointer-events: none;
  background: color-mix(in srgb, var(--primary-color, #5ea0ff) 30%, transparent);
  box-shadow: inset 0 0 0 2px var(--primary-color, #5ea0ff);
}
.tb-drop.edge-top { top: 0; left: 0; right: 0; height: 6px; }
.tb-drop.edge-bottom { bottom: 0; left: 0; right: 0; height: 6px; }
.tb-drop.edge-left { top: 0; bottom: 0; left: 0; width: 6px; }
.tb-drop.edge-right { top: 0; bottom: 0; right: 0; width: 6px; }

/* ---- 操作簇 ---- */
.tb-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}
.orient-vertical .tb-actions {
  flex-direction: column;
  align-items: stretch;
}
.tb-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 24px;
  padding: 0 8px;
  border: none;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.08);
  color: inherit;
  font-size: 12px;
  line-height: 1;
  white-space: nowrap;
  cursor: pointer;
}
.tb-btn:hover {
  background: rgba(255, 255, 255, 0.18);
}
.tb-grip {
  cursor: grab;
  touch-action: none;
}

/* ---- 标签 / 开关 / 分隔线 ---- */
.tb-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  white-space: nowrap;
}
.tb-label {
  font-size: 12px;
  opacity: 0.85;
  white-space: nowrap;
}
.tb-sep {
  width: 1px;
  height: 18px;
  background: rgba(255, 255, 255, 0.18);
}
.orient-vertical .tb-sep {
  width: 100%;
  height: 1px;
}

/* ---- 控件宽度 ---- */
/*
 * PrimeVue InputNumber 的内层 <input> 默认按 size 撑到约 223px，且 flex 项
 * min-width:auto 使其无法收缩，从而溢出根元素的声明宽度，导致控件（尤其自定义缩放）
 * 在横排/竖排下都显得过长。这里允许内层 input 收缩，使其恰为声明宽度。
 */
.canvas-toolbar :deep(.p-inputnumber-input) {
  min-width: 0;
}
.grid-preset { width: 84px; }
.grid-number { width: 92px; }
.screen-preset { width: 150px; }
.screen-dim { width: 104px; }
.zoom-preset { width: 92px; }
.zoom-number { width: 92px; }
</style>
