<script setup lang="ts">
/**
 * SnoozePanel 插件配置界面（HA 插件自身的五区布局，决策见 doc/ARCHITECTURE.md）。
 *
 * 五个区域（各自独立子组件，本组件仅做编排与状态持有）：
 *   1. 插件菜单栏（顶，可收起）：EditorMenuBar
 *   2. 组件分类选择区（左，可拖宽 / 收起 / 恢复默认宽度）：CategoryPanel
 *   3. 屏保效果阅览与位置尺寸编辑区（中）：EditorCanvas
 *   4. 组件属性编辑器（右，可拖宽 / 收起 / 恢复默认宽度）：PropertyPanel
 *   5. 插件状态栏（底）：StatusBar
 *
 * 该组件被 HA 卡片编辑弹窗、HA 侧边栏与 dev 本地实测台三种宿主复用，
 * 菜单栏与状态栏属于插件自身，宿主只负责给出可用尺寸。
 * 面板尺寸 / 收起态 / 画布网格偏好存 localStorage（仅 UI 偏好，见 useEditorLayout）；
 * 插件配置的持久化必须走 HA 后端（见 doc/TODO.md）。
 */
import { computed, nextTick, onBeforeUnmount, onMounted, provide, reactive, ref, watch } from 'vue';
import type { SnoozeConfig } from '@/core/types';
import type { HassLike } from '@/core/hass';
import { resolveDeviceId } from '@/core/device';
import { Ticker } from '@/runtime/ticker';
import { useEditorLayout, GRID_STEP_PRESETS, DEFAULT_EDITOR_LAYOUT, type PanelKey } from './useEditorLayout';
import { acquireChromeTheme, releaseChromeTheme } from './chromeTheme';
import { useEditorDraft } from './composables/useEditorDraft';
import { useComponentSelection } from './composables/useComponentSelection';
import { useDeviceSave } from './composables/useDeviceSave';
import { EditorDraftKey, EditorLayoutKey, EditorSelectionKey } from './editorContext';
import EditorMenuBar from './components/EditorMenuBar.vue';
import CategoryPanel from './components/CategoryPanel.vue';
import EditorCanvas from './components/EditorCanvas.vue';
import PropertyPanel from './components/PropertyPanel.vue';
import StatusBar from './components/StatusBar.vue';
import FaceMarketplace from './FaceMarketplace.vue';
import Toast from 'primevue/toast';

const props = defineProps<{
  config: SnoozeConfig;
  hass: HassLike | null;
}>();

const emit = defineEmits<{
  (e: 'change', config: SnoozeConfig): void;
}>();

// ---- 本地草稿与对外变更桥接（回声防护 + 300ms 防抖 emit） ----
const { draft } = useEditorDraft(props, emit);
// 编辑草稿 / UI 偏好 / 选中态经 provide 下发，供五区子组件注入（共享 reactive，就地写回）
provide(EditorDraftKey, draft);

// 为预览画布提供 snoozeState（ScreensaverApp 通过 inject 获取）
const previewState = reactive({
  now: new Date(),
  hass: props.hass ?? ({ states: {} } as HassLike),
});
provide('snoozeState', previewState);

// 预览画布时钟：每秒推进一次（后台标签页自动暂停），卸载时停表
const previewTicker = new Ticker((now) => {
  previewState.now = now;
});

// 预览画布设备 id（展示用，不影响逻辑）
const deviceId = resolveDeviceId();

// HA 侧异步注入 hass：变化时同步给预览画布
watch(
  () => props.hass,
  (next) => {
    previewState.hass = next ?? ({ states: {} } as HassLike);
  },
);

// ---- 表盘市场模态 ----
const marketplaceVisible = ref(false);

function openMarketplace(): void {
  marketplaceVisible.value = true;
}

function onMarketplaceClose(): void {
  marketplaceVisible.value = false;
}

function onFaceSelected(faceId: string): void {
  draft.components.clock.style = faceId;
}

// ---- 设备级覆盖（后端持久化，含 Toast 反馈） ----
const { deviceSaving, deviceSaved, onSaveDevice } = useDeviceSave(props, deviceId, draft);

// ---- 选中组件状态与派生数据（左右面板 / 画布共享） ----
const selection = useComponentSelection(draft);
provide(EditorSelectionKey, selection);
const {
  selectedComponent,
  componentList,
  selectedLabel,
  setComponentShow,
  addText,
  onCanvasSelect,
  updateComponentLayout,
} = selection;

// ---- 天气实体候选（从 hass 中筛 weather.*） ----
const weatherEntities = computed(() => {
  if (!props.hass) return [];
  return Object.keys(props.hass.states).filter((id) => id.startsWith('weather.'));
});

// ---- 编辑器 UI 偏好（面板宽度 / 收起态 / 画布网格） ----
const {
  layout: uiLayout,
  catsCollapsed,
  propsCollapsed,
  catsWidth,
  propsWidth,
  canvasGrid,
  applyHostWidth,
  clampToHost,
  startResize,
  togglePanel,
  restorePanelWidth,
  toggleMenu,
  setGridStep,
  resetGrid,
} = useEditorLayout();
provide(EditorLayoutKey, uiLayout);

const bodyEl = ref<HTMLElement | null>(null);
let hostObserver: ResizeObserver | null = null;

/** 宿主尺寸同步：窄宿主自动收起左右面板，并收敛宽度保证画布不被挤没 */
function syncHostSize(): void {
  const w = bodyEl.value?.getBoundingClientRect().width ?? 0;
  applyHostWidth(w);
  clampToHost(w);
}

/** 面板拖拽入口（在组件内解析宿主元素，避免模板里做空值断言） */
function onResizeStart(which: PanelKey, ev: PointerEvent): void {
  const host = bodyEl.value;
  if (!host) return;
  startResize(which, ev, host);
}

// ---- 画布工具条（网格尺寸预设） ----
const GRID_PRESETS = GRID_STEP_PRESETS.map((v) => ({ label: `${v}%`, value: v }));

/** 网格步长（写入前统一裁剪到 [1, 20]%） */
const gridStep = computed<number>({
  get: () => uiLayout.grid.step,
  set: (v) => setGridStep(Number(v ?? DEFAULT_EDITOR_LAYOUT.grid.step)),
});

// ---- 状态栏 ----
/** 相对宿主传入配置是否有未提交的改动 */
const dirty = computed(() => JSON.stringify(draft) !== JSON.stringify(props.config));

/** 状态栏中段提示：选中对象 + 当前网格吸附档位 */
const statusHint = computed(() => {
  const grid = uiLayout.grid.snap
    ? `网格吸附 ${uiLayout.grid.step}%`
    : uiLayout.grid.show
      ? `网格显示 ${uiLayout.grid.step}%（未吸附）`
      : '网格已关闭';
  return `选中：${selectedLabel.value} · ${grid}`;
});

/** 状态栏右侧：优先显示保存反馈，其次显示同步状态 */
const saveState = computed(() => {
  if (deviceSaved.value) return { text: deviceSaved.value, cls: 'ok' };
  return dirty.value ? { text: '未保存更改', cls: 'warn' } : { text: '配置已同步', cls: 'ok' };
});

onMounted(() => {
  // 暗色外观：给 documentElement 挂类，使 teleport 到 body 的浮层共用暗色令牌
  acquireChromeTheme();
  previewTicker.start();
  previewTicker.watchVisibility();
  // 宿主尺寸自适应（首帧 + 后续变化）
  void nextTick(syncHostSize);
  if (typeof ResizeObserver !== 'undefined') {
    hostObserver = new ResizeObserver(syncHostSize);
    if (bodyEl.value) hostObserver.observe(bodyEl.value);
  }
  window.addEventListener('resize', syncHostSize);
});

onBeforeUnmount(() => {
  releaseChromeTheme();
  previewTicker.destroy();
  hostObserver?.disconnect();
  hostObserver = null;
  window.removeEventListener('resize', syncHostSize);
});
</script>

<template>
  <div class="plugin-shell snooze-editor-dark">
    <!-- 保存等操作反馈的 Toast 容器（底部右侧，自动消失） -->
    <Toast position="bottom-right" />

    <!-- ============ 1. 插件菜单栏（顶，可收起） ============ -->
    <EditorMenuBar
      :collapsed="uiLayout.menuCollapsed"
      :hass="hass"
      :device-id="deviceId"
      :device-saving="deviceSaving"
      :device-saved="deviceSaved"
      @toggle-collapse="toggleMenu"
      @save="onSaveDevice"
    />

    <!-- ============ 工作区：左分类 / 中画布 / 右属性 ============ -->
    <div ref="bodyEl" class="plugin-body">
      <!-- ---- 2. 组件分类选择区 ---- -->
      <CategoryPanel
        :components="componentList"
        :selected="selectedComponent"
        :collapsed="catsCollapsed"
        :width="catsWidth"
        @select="onCanvasSelect"
        @toggle-show="setComponentShow"
        @add-text="addText"
        @toggle-panel="togglePanel('cats')"
        @restore-width="restorePanelWidth('cats')"
        @resize-start="onResizeStart('cats', $event)"
      />

      <!-- ---- 3. 屏保效果阅览与位置尺寸编辑区 ---- -->
      <EditorCanvas
        :config="draft"
        :device-id="deviceId"
        :grid="canvasGrid"
        :selected="selectedComponent"
        :grid-step="gridStep"
        :grid-presets="GRID_PRESETS"
        @update:grid-step="gridStep = $event"
        @reset-grid="resetGrid"
        @update:layout="updateComponentLayout"
        @select="onCanvasSelect"
      />

      <!-- ---- 4. 组件属性编辑器 ---- -->
      <PropertyPanel
        :weather-entities="weatherEntities"
        :collapsed="propsCollapsed"
        :width="propsWidth"
        @open-marketplace="openMarketplace"
        @toggle-panel="togglePanel('props')"
        @restore-width="restorePanelWidth('props')"
        @resize-start="onResizeStart('props', $event)"
      />
    </div>

    <!-- ============ 5. 插件状态栏（底） ============ -->
    <StatusBar :device-id="deviceId" :hint="statusHint" :state="saveState" />

    <!-- 表盘市场模态（弹窗覆盖层） -->
    <FaceMarketplace
      v-if="marketplaceVisible"
      :model-value="draft.components.clock.style"
      :theme="draft.theme"
      :seconds="draft.components.clock.seconds"
      :hour24="draft.components.clock.hour24"
      @update:model-value="onFaceSelected"
      @close="onMarketplaceClose"
    />
  </div>
</template>

<style scoped>
/* 拖拽面板宽度时全局光标（与 useEditorLayout 的 sp-editor-resizing 类对应） */
:global(html.sp-editor-resizing) {
  cursor: col-resize !important;
  user-select: none;
}
:global(html.sp-editor-resizing) * {
  cursor: col-resize !important;
}

/* ============ 插件外壳：菜单栏 / 工作区 / 状态栏 纵向三行 ============ */
.plugin-shell {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  /* HA 卡片编辑弹窗为自动高度宿主：留 min-height 避免高度塌陷 */
  min-height: 460px;
  overflow: hidden;
  background: var(--sp-chrome-bg, #33373a);
  color: var(--sp-chrome-text, #d8dcdf);
}

/* ============ 工作区：左分类 / 中画布 / 右属性 ============ */
.plugin-body {
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
</style>

<style>
/*
 * 编辑器暗色外观（PS6 风格暗灰）——全局非 scoped。
 * 恒定暗色外壳：不随 HA 主题切换，避免浅色主题下大片亮底刺眼。
 * 令牌挂在 .snooze-editor-dark 上（EditorApp 挂载时将其加到 documentElement），
 * 使 teleport 到 body 的 Popover / Dialog / Toast 与外壳共用同一套底色与文字色。
 */
.snooze-editor-dark {
  --sp-chrome-bg: #33373a; /* 面板 / 菜单 / 状态栏底色 */
  --sp-chrome-bg-2: #3f4448; /* 悬停 / 抬升面 */
  --sp-chrome-sunken: #2a2d30; /* 下沉 / 输入底 */
  --sp-chrome-border: #494e52; /* 分隔线 / 描边 */
  --sp-chrome-text: #d8dcdf; /* 主文字 */
  --sp-chrome-text-dim: #98a0a6; /* 次要文字 / 提示 */
}
</style>
