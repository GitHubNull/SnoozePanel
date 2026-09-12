<script setup lang="ts">
/**
 * SnoozePanel 插件配置界面（HA 插件自身的五区布局，决策见 doc/ARCHITECTURE.md）。
 *
 * 五个区域：
 *   1. 插件菜单栏（顶，可收起）：品牌 + 全局配置菜单浮层 + 启用开关 / 保存到后端 / 收起
 *   2. 组件分类选择区（左，可拖宽 / 收起 / 恢复默认宽度）
 *   3. 屏保效果阅览与位置尺寸编辑区（中）：网格 + 磁吸附 + 拖拽等比缩放 + 点选联动
 *   4. 组件属性编辑器（右，可拖宽 / 收起 / 恢复默认宽度）：选中组件的全部可配置属性
 *   5. 插件状态栏（底）：设备 id / 选中与网格提示 / 保存状态
 *
 * 该组件被 HA 卡片编辑弹窗、HA 侧边栏与 dev 本地实测台三种宿主复用，
 * 菜单栏与状态栏属于插件自身，宿主只负责给出可用尺寸。
 * 面板尺寸 / 收起态 / 画布网格偏好存 localStorage（仅 UI 偏好）；
 * 插件配置的持久化必须走 HA 后端（见 doc/TODO.md）。
 */
import { reactive, watch, computed, ref, nextTick, provide, onMounted, onBeforeUnmount } from 'vue';
import type { SnoozeConfig, ComponentLayout } from '@/core/types';
import { DEFAULT_LAYOUTS } from '@/core/types';
import type { HassLike } from '@/core/hass';
import { listFaceOptions } from '@/ui/faces/registry';
import { saveDeviceConfig } from '@/core/store';
import { attachHexHash } from '@/core/config';
import { resolveDeviceId } from '@/core/device';
import FacePreview from '@/ui/components/FacePreview.vue';
import FaceMarketplace from './FaceMarketplace.vue';
import BasicPanel from './panels/BasicPanel.vue';
import AppearancePanel from './panels/AppearancePanel.vue';
import ConditionsPanel from './panels/ConditionsPanel.vue';
import DevicePanel from './panels/DevicePanel.vue';
import AdvancedPanel from './panels/AdvancedPanel.vue';
import { Ticker } from '@/runtime/ticker';
import { useEditorLayout, GRID_STEP_PRESETS, DEFAULT_EDITOR_LAYOUT, type PanelKey } from './useEditorLayout';
import Toast from 'primevue/toast';
import { useToast } from 'primevue/usetoast';
import ToggleSwitch from 'primevue/toggleswitch';
import InputNumber from 'primevue/inputnumber';
import InputText from 'primevue/inputtext';
import Select from 'primevue/select';
import Button from 'primevue/button';
import ColorPicker from 'primevue/colorpicker';
import Popover from 'primevue/popover';
import ScreensaverApp from '@/ui/ScreensaverApp.vue';

const props = defineProps<{
  config: SnoozeConfig;
  hass: HassLike | null;
}>();

const emit = defineEmits<{
  (e: 'change', config: SnoozeConfig): void;
}>();

// 本地草稿，任何字段变更后整体 emit（深拷贝避免引用污染）
const draft = reactive<SnoozeConfig>(JSON.parse(JSON.stringify(props.config)) as SnoozeConfig);

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

/**
 * 回声防护：HA 侧把 config-changed 的结果回填给 setConfig 时，
 * props.config 变化 → 同步草稿 → 草稿深度 watcher 触发 → 若不拦截会再次 emit，
 * 形成 emit → setConfig → emit 的无限循环。
 * 同步期间置位标记，待草稿 watcher 本轮执行完毕（nextTick）后复位。
 */
let syncingFromProps = false;

watch(
  () => props.config,
  (next) => {
    syncingFromProps = true;
    Object.assign(draft, JSON.parse(JSON.stringify(next)) as SnoozeConfig);
    void nextTick(() => {
      syncingFromProps = false;
    });
  },
  { deep: true },
);

let emitTimer: ReturnType<typeof setTimeout> | null = null;
watch(
  draft,
  () => {
    // 仅 props 回填引起的同步不对外 emit
    if (syncingFromProps) return;
    // 防抖 300ms，避免输入过程中频繁触发 config-changed
    if (emitTimer !== null) clearTimeout(emitTimer);
    emitTimer = setTimeout(() => {
      emit('change', JSON.parse(JSON.stringify(draft)) as SnoozeConfig);
    }, 300);
  },
  { deep: true },
);

// HA 侧异步注入 hass：变化时同步给预览画布
watch(
  () => props.hass,
  (next) => {
    previewState.hass = next ?? ({ states: {} } as HassLike);
  },
);

// ---- 表盘选项 ----
// 表盘选项：从注册表动态生成（label 中文名，value 表盘 id，kind 种类，source 来源）
const CLOCK_STYLES = listFaceOptions().map((f) => ({
  label: f.label,
  value: f.id,
  kind: f.kind,
  source: f.source,
}));

/** 表盘 id → 中文名 */
function faceLabel(id: string): string {
  return CLOCK_STYLES.find((f) => f.value === id)?.label ?? id;
}

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

// ---- 保存反馈 Toast ----
const toast = useToast();

// ---- 设备级覆盖（后端持久化） ----
const deviceSaving = ref(false);
const deviceSaved = ref('');

/** 把当前草稿整体存为本设备的后端覆盖配置（含 Toast 反馈） */
async function onSaveDevice(): Promise<void> {
  if (!props.hass) {
    deviceSaved.value = '后端不可用';
    toast.add({
      severity: 'warn',
      summary: '后端不可用',
      detail: '当前环境未连接 Home Assistant，无法保存设备级配置。',
      life: 4000,
    });
    return;
  }
  deviceSaving.value = true;
  deviceSaved.value = '';
  try {
    const ok = await saveDeviceConfig(props.hass, deviceId, JSON.parse(JSON.stringify(draft)) as SnoozeConfig);
    deviceSaved.value = ok ? '已保存到后端' : '保存失败（后端不可用）';
    if (ok) {
      toast.add({
        severity: 'success',
        summary: '保存成功',
        detail: `配置已保存为本设备（${deviceId}）的独立覆盖。`,
        life: 3000,
      });
      setTimeout(() => { deviceSaved.value = ''; }, 3000);
    } else {
      toast.add({
        severity: 'error',
        summary: '保存失败',
        detail: '后端未接受本次写入，请检查连接后重试。',
        life: 5000,
      });
    }
  } catch (err) {
    deviceSaved.value = '保存异常';
    toast.add({
      severity: 'error',
      summary: '保存异常',
      detail: err instanceof Error ? err.message : String(err),
      life: 5000,
    });
  } finally {
    deviceSaving.value = false;
  }
}

// ---- 天气实体候选（从 hass 中筛 weather.*） ----
const weatherEntities = computed(() => {
  if (!props.hass) return [];
  return Object.keys(props.hass.states).filter((id) => id.startsWith('weather.'));
});

// ---- 插件菜单栏 ----
type MenuKey = 'basic' | 'appearance' | 'conditions' | 'device' | 'advanced';

const MENUS: { key: MenuKey; label: string }[] = [
  { key: 'basic', label: '基础' },
  { key: 'appearance', label: '外观' },
  { key: 'conditions', label: '条件' },
  { key: 'device', label: '设备' },
  { key: 'advanced', label: '高级' },
];

/** 当前展开的菜单（null 表示全部收起） */
const openMenu = ref<MenuKey | null>(null);
/** 单一 Popover 实例：内容随 openMenu 切换，故只需一个锚定浮层 */
const menuPopover = ref();
const openMenuLabel = computed(() => MENUS.find((m) => m.key === openMenu.value)?.label ?? '');

/** 打开 / 切换某组菜单浮层（重复点击同一项即关闭） */
function toggleMenuPanel(key: MenuKey, ev: MouseEvent): void {
  if (openMenu.value === key) {
    menuPopover.value?.hide();
    openMenu.value = null;
    return;
  }
  openMenu.value = key;
  // 等浮层内容切换完成后再定位，保证按新内容尺寸对齐按钮
  void nextTick(() => menuPopover.value?.show(ev));
}

function onMenuHide(): void {
  openMenu.value = null;
}

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

// ---- 画布工具条（网格 / 磁吸 / 网格尺寸） ----
const GRID_PRESETS = GRID_STEP_PRESETS.map((v) => ({ label: `${v}%`, value: v }));

/** 网格步长（写入前统一裁剪到 [1, 20]%） */
const gridStep = computed<number>({
  get: () => uiLayout.grid.step,
  set: (v) => setGridStep(Number(v ?? DEFAULT_EDITOR_LAYOUT.grid.step)),
});

// ---- 设计器状态 ----
const selectedComponent = ref<string>('clock');

/** 组件分类清单（四类固定组件 + 每条自定义文本各成一项） */
const componentList = computed(() => {
  const list = [
    { key: 'clock', label: '时钟', show: draft.components.clock.show, toggleable: true },
    { key: 'calendar', label: '日历', show: draft.components.calendar.show, toggleable: true },
    { key: 'lunar', label: '农历', show: draft.components.lunar.show, toggleable: true },
    { key: 'weather', label: '天气', show: draft.components.weather.show, toggleable: true },
  ];
  // 每条自定义文本在列表中单独列出并各带显隐开关（复用 per-text 的 show 字段）；
  // 标签取文本内容（空则「文本 N」），使「室温 …」这类项一眼可辨。
  draft.components.texts.forEach((t, i) => {
    list.push({
      key: `text_${i}`,
      label: t.content.trim() || `文本 ${i + 1}`,
      show: t.show !== false,
      toggleable: true,
    });
  });
  return list;
});

/** 当前选中组件的中文名（右侧属性面板标题 / 状态栏提示） */
const selectedLabel = computed(
  () => componentList.value.find((c) => c.key === selectedComponent.value)?.label ?? '',
);

/** 组件显隐开关（clock/calendar/lunar/weather，以及每条自定义文本 text_N） */
function setComponentShow(key: string, value: boolean): void {
  switch (key) {
    case 'clock': draft.components.clock.show = value; break;
    case 'calendar': draft.components.calendar.show = value; break;
    case 'lunar': draft.components.lunar.show = value; break;
    case 'weather': draft.components.weather.show = value; break;
    default:
      // 单条自定义文本（text_0 / text_1 …）
      if (key.startsWith('text_')) {
        const idx = Number(key.slice(5));
        if (draft.components.texts[idx]) draft.components.texts[idx].show = value;
      }
  }
}

/** 新增一条自定义文本并立即选中（右侧随即出现该条文本的属性） */
function addText(): void {
  draft.components.texts.push({ content: '', layout: { ...DEFAULT_LAYOUTS.text }, show: true });
  selectedComponent.value = `text_${draft.components.texts.length - 1}`;
}

/** 当前选中的单条自定义文本下标（未选中文本时返回 -1） */
const selectedTextIndex = computed(() => {
  if (!selectedComponent.value.startsWith('text_')) return -1;
  const idx = Number(selectedComponent.value.slice(5));
  return draft.components.texts[idx] ? idx : -1;
});

/** 当前选中单条文本的内容（供属性面板直接编辑；未选中文本时返回空串） */
const selectedTextContent = computed<string>({
  get: () => {
    const i = selectedTextIndex.value;
    return i >= 0 ? draft.components.texts[i].content : '';
  },
  set: (v: string) => {
    const i = selectedTextIndex.value;
    if (i >= 0) draft.components.texts[i].content = v;
  },
});

/** 当前选中单条文本的显隐（供属性面板开关） */
const selectedTextShow = computed<boolean>({
  get: () => {
    const i = selectedTextIndex.value;
    return i >= 0 ? draft.components.texts[i].show !== false : true;
  },
  set: (v: boolean) => {
    const i = selectedTextIndex.value;
    if (i >= 0) draft.components.texts[i].show = v;
  },
});

/** 删除当前选中的自定义文本（选中态回退到时钟） */
function removeSelectedText(): void {
  const idx = selectedTextIndex.value;
  if (idx < 0) return;
  draft.components.texts.splice(idx, 1);
  selectedComponent.value = 'clock';
}

/** 画布点选组件 → 左侧分类与右侧属性同步切换 */
function onCanvasSelect(compKey: string): void {
  selectedComponent.value = compKey;
}

/** 当前选中组件的 layout */
const currentLayout = computed<ComponentLayout>({
  get: () => {
    if (selectedComponent.value.startsWith('text_')) {
      const text = draft.components.texts[Number(selectedComponent.value.slice(5))];
      if (text) return text.layout;
    }
    switch (selectedComponent.value) {
      case 'clock': return draft.components.clock.layout;
      case 'calendar': return draft.components.calendar.layout;
      case 'lunar': return draft.components.lunar.layout;
      case 'weather': return draft.components.weather.layout;
      default: return draft.components.clock.layout;
    }
  },
  set: (v) => {
    if (selectedComponent.value.startsWith('text_')) {
      const text = draft.components.texts[Number(selectedComponent.value.slice(5))];
      if (text) text.layout = v;
      return;
    }
    switch (selectedComponent.value) {
      case 'clock': draft.components.clock.layout = v; break;
      case 'calendar': draft.components.calendar.layout = v; break;
      case 'lunar': draft.components.lunar.layout = v; break;
      case 'weather': draft.components.weather.layout = v; break;
    }
  },
});

/** 当前选中组件的 color */
const currentColor = computed<string>({
  get: () => {
    if (selectedComponent.value.startsWith('text_')) {
      return draft.components.texts[Number(selectedComponent.value.slice(5))]?.color ?? '';
    }
    switch (selectedComponent.value) {
      case 'clock': return draft.components.clock.color ?? '';
      case 'calendar': return draft.components.calendar.color ?? '';
      case 'lunar': return draft.components.lunar.color ?? '';
      case 'weather': return draft.components.weather.color ?? '';
      default: return '';
    }
  },
  set: (v) => {
    const val = v || undefined;
    if (selectedComponent.value.startsWith('text_')) {
      const text = draft.components.texts[Number(selectedComponent.value.slice(5))];
      if (text) text.color = val;
      return;
    }
    switch (selectedComponent.value) {
      case 'clock': draft.components.clock.color = val; break;
      case 'calendar': draft.components.calendar.color = val; break;
      case 'lunar': draft.components.lunar.color = val; break;
      case 'weather': draft.components.weather.color = val; break;
    }
  },
});

function setCurrentColor(v: string): void {
  // ColorPicker（format=hex）输出不带 '#' 的裸 hex（如 175cd4），补 '#' 后才是合法 CSS；
  // 否则配置层 normalizeColor 会判为非法而丢弃，表现为「改不了颜色」。
  currentColor.value = attachHexHash(String(v ?? ''));
}

/** 更新指定组件的 layout（数字输入直接绑定 draft，此处供预览画布拖拽回写） */
function updateComponentLayout(compKey: string, layout: ComponentLayout): void {
  if (compKey === 'clock') {
    draft.components.clock.layout = layout;
  } else if (compKey === 'calendar') {
    draft.components.calendar.layout = layout;
  } else if (compKey === 'lunar') {
    draft.components.lunar.layout = layout;
  } else if (compKey === 'weather') {
    draft.components.weather.layout = layout;
  } else if (compKey.startsWith('text_')) {
    const idx = Number(compKey.slice(5));
    if (draft.components.texts[idx]) {
      draft.components.texts[idx].layout = layout;
    }
  }
}

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
  previewTicker.destroy();
  hostObserver?.disconnect();
  hostObserver = null;
  window.removeEventListener('resize', syncHostSize);
});
</script>

<template>
  <div class="plugin-shell" :class="{ 'menu-collapsed': uiLayout.menuCollapsed }">
    <!-- 保存等操作反馈的 Toast 容器（底部右侧，自动消失） -->
    <Toast position="bottom-right" />

    <!-- ============ 1. 插件菜单栏（顶，可收起） ============ -->
    <header class="plugin-menu">
      <template v-if="!uiLayout.menuCollapsed">
        <div class="menu-brand">
          <span class="menu-brand-name">SnoozePanel</span>
          <span class="menu-brand-sub">屏保配置</span>
        </div>
        <nav class="menu-nav">
          <Button
            v-for="m in MENUS"
            :key="m.key"
            :label="m.label"
            size="small"
            text
            :class="{ active: openMenu === m.key }"
            @click="toggleMenuPanel(m.key, $event)"
          />
        </nav>
        <div class="menu-actions">
          <label class="menu-switch">
            <ToggleSwitch v-model="draft.enabled" />
            <span>启用屏保</span>
          </label>
          <Button
            :loading="deviceSaving"
            label="保存到后端"
            icon="pi pi-cloud-upload"
            size="small"
            @click="onSaveDevice"
          />
          <Button
            icon="pi pi-angle-up"
            size="small"
            text
            title="收起菜单栏"
            aria-label="收起菜单栏"
            @click="toggleMenu"
          />
        </div>
      </template>

      <!-- 收起态：细条（品牌 + 启用状态 + 展开按钮） -->
      <template v-else>
        <div class="menu-brand slim">
          <span class="menu-brand-name">SnoozePanel</span>
          <span class="menu-state">{{ draft.enabled ? '已启用' : '已停用' }}</span>
        </div>
        <Button
          icon="pi pi-angle-down"
          label="展开菜单栏"
          size="small"
          text
          title="展开菜单栏"
          @click="toggleMenu"
        />
      </template>
    </header>

    <!-- 全局配置菜单浮层（单一 Popover，内容随 openMenu 切换） -->
    <Popover ref="menuPopover" @hide="onMenuHide">
      <div class="menu-panel">
        <div class="menu-panel-title">{{ openMenuLabel }}</div>
        <BasicPanel
          v-if="openMenu === 'basic'"
          v-model:idle-seconds="draft.idle_seconds"
          v-model:exit-cooldown="draft.exit_cooldown_seconds"
          v-model:screensaver-entity="draft.screensaver_entity"
        />
        <AppearancePanel
          v-else-if="openMenu === 'appearance'"
          v-model:theme="draft.theme"
          v-model:background="draft.background"
        />
        <ConditionsPanel
          v-else-if="openMenu === 'conditions'"
          v-model:conditions="draft.conditions"
          :hass="hass"
        />
        <DevicePanel
          v-else-if="openMenu === 'device'"
          v-model:devices="draft.devices"
          :device-id="deviceId"
          :saving="deviceSaving"
          :saved="deviceSaved"
          @save="onSaveDevice"
        />
        <AdvancedPanel
          v-else-if="openMenu === 'advanced'"
          v-model:display-template="draft.display_template"
          v-model:component-templates="draft.component_templates"
        />
      </div>
    </Popover>

    <!-- ============ 工作区：左分类 / 中画布 / 右属性 ============ -->
    <div ref="bodyEl" class="plugin-body">
      <!-- ---- 2. 组件分类选择区 ---- -->
      <aside class="plugin-cats" :class="{ collapsed: catsCollapsed }" :style="{ width: catsWidth + 'px' }">
        <template v-if="!catsCollapsed">
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
                @click="restorePanelWidth('cats')"
              />
              <Button
                icon="pi pi-angle-double-left"
                size="small"
                text
                rounded
                title="收起"
                aria-label="收起组件分类区"
                @click="togglePanel('cats')"
              />
            </span>
          </div>
          <div class="panel-scroll">
            <div class="component-list">
              <div
                v-for="comp in componentList"
                :key="comp.key"
                class="component-item"
                :class="{ active: selectedComponent === comp.key }"
                @click="selectedComponent = comp.key"
              >
                <ToggleSwitch
                  :model-value="comp.show"
                  @update:model-value="setComponentShow(comp.key, $event)"
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
              @click="addText"
            />
          </div>
          <!-- 右边缘拖拽条：调整分类区宽度 -->
          <span
            class="resizer"
            role="separator"
            aria-orientation="vertical"
            aria-label="拖拽调整组件分类区宽度"
            @pointerdown="onResizeStart('cats', $event)"
          ></span>
        </template>

        <!-- 收起态：竖向滑轨 -->
        <button v-else type="button" class="rail" title="展开组件分类区" aria-label="展开组件分类区" @click="togglePanel('cats')">
          <span class="rail-label">组件分类</span>
        </button>
      </aside>

      <!-- ---- 3. 屏保效果阅览与位置尺寸编辑区 ---- -->
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
            v-model="gridStep"
            :options="GRID_PRESETS"
            option-label="label"
            option-value="value"
            size="small"
            class="grid-preset"
            aria-label="网格尺寸预设"
          />
          <InputNumber
            v-model="gridStep"
            :min="1"
            :max="20"
            :step="0.5"
            :show-buttons="true"
            suffix="%"
            size="small"
            class="grid-number"
            aria-label="网格尺寸百分比"
          />
          <Button label="恢复默认" size="small" text @click="resetGrid" />
        </div>

        <ScreensaverApp
          :config="draft"
          :device-id="deviceId"
          :grid="canvasGrid"
          :selected="selectedComponent"
          edit-mode
          @update:layout="updateComponentLayout"
          @select="onCanvasSelect"
        />
      </main>

      <!-- ---- 4. 组件属性编辑器 ---- -->
      <aside class="plugin-props" :class="{ collapsed: propsCollapsed }" :style="{ width: propsWidth + 'px' }">
        <template v-if="!propsCollapsed">
          <span
            class="resizer"
            role="separator"
            aria-orientation="vertical"
            aria-label="拖拽调整组件属性区宽度"
            @pointerdown="onResizeStart('props', $event)"
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
                @click="restorePanelWidth('props')"
              />
              <Button
                icon="pi pi-angle-double-right"
                size="small"
                text
                rounded
                title="收起"
                aria-label="收起组件属性区"
                @click="togglePanel('props')"
              />
            </span>
          </div>
          <div class="panel-scroll">
            <div class="props-subject">{{ selectedLabel }}</div>

            <!-- 时钟属性：表盘卡片 + 时间显示 -->
            <template v-if="selectedComponent === 'clock'">
              <div class="face-selector-card" @click="openMarketplace">
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
                <InputText v-model="selectedTextContent" class="w-full" placeholder="文本内容，可含 {entity_id} 占位符" />
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
        <button v-else type="button" class="rail" title="展开组件属性区" aria-label="展开组件属性区" @click="togglePanel('props')">
          <span class="rail-label">组件属性</span>
        </button>
      </aside>
    </div>

    <!-- ============ 5. 插件状态栏（底） ============ -->
    <footer class="plugin-status">
      <span class="status-item">设备 {{ deviceId }}</span>
      <span class="status-item status-hint">{{ statusHint }}</span>
      <span class="status-item" :class="saveState.cls">{{ saveState.text }}</span>
    </footer>

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
  background: var(--card-background-color, #fff);
  color: var(--primary-text-color, #1c1c1c);
}

/* ============ 1. 插件菜单栏（顶） ============ */
.plugin-menu {
  display: flex;
  align-items: center;
  gap: 16px;
  flex: none;
  height: 52px;
  padding: 0 12px;
  border-bottom: 1px solid var(--divider-color, #e0e0e0);
  background: var(--card-background-color, #fff);
}
.plugin-shell.menu-collapsed .plugin-menu {
  height: 40px;
}
.menu-brand {
  display: flex;
  flex-direction: column;
  line-height: 1.15;
  flex: none;
}
.menu-brand-name {
  font-weight: 700;
  font-size: 14px;
}
.menu-brand-sub {
  font-size: 11px;
  color: var(--secondary-text-color, #888);
}
.menu-brand.slim {
  flex-direction: row;
  align-items: baseline;
  gap: 8px;
}
.menu-state {
  font-size: 12px;
  color: var(--secondary-text-color, #888);
}
.menu-nav {
  display: flex;
  align-items: center;
  gap: 2px;
  flex: 1;
  min-width: 0;
  overflow-x: auto;
}
.menu-nav :deep(.p-button.active) {
  background: var(--primary-color, #5ea0ff);
  color: #fff;
}
.menu-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: none;
  margin-left: auto;
}
.menu-switch {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  white-space: nowrap;
}

/* 全局配置菜单浮层 */
.menu-panel {
  width: 320px;
  max-height: min(70vh, 560px);
  overflow-y: auto;
}
.menu-panel-title {
  font-weight: 700;
  font-size: 13px;
  margin-bottom: 12px;
  color: var(--primary-color, #5ea0ff);
}

/* ============ 工作区：左分类 / 中画布 / 右属性 ============ */
.plugin-body {
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

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
.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  flex: none;
  padding: 8px 12px;
  border-bottom: 1px solid var(--divider-color, #e0e0e0);
}
.panel-title {
  font-weight: 700;
  font-size: 13px;
}
.panel-head-actions {
  display: flex;
  align-items: center;
  gap: 2px;
}
.panel-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 12px;
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

/* ---- 4. 组件属性编辑器（右） ---- */
.plugin-props {
  display: flex;
  flex-direction: column;
  flex: none;
  min-height: 0;
  position: relative;
  border-left: 1px solid var(--divider-color, #e0e0e0);
  background: var(--card-background-color, #fff);
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

/* 面板边缘拖拽条（宽 6px，悬停高亮） */
.resizer {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 6px;
  cursor: col-resize;
  z-index: 8;
  touch-action: none;
}
.plugin-cats .resizer {
  right: -3px;
}
.plugin-props .resizer {
  left: -3px;
}
.resizer:hover,
:global(html.sp-editor-resizing) .resizer {
  background: var(--primary-color, #5ea0ff);
}

/* 收起态滑轨 */
.rail {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  color: var(--secondary-text-color, #888);
}
.rail:hover {
  color: var(--primary-color, #5ea0ff);
}
.rail-label {
  writing-mode: vertical-rl;
  text-orientation: upright;
  letter-spacing: 0.15em;
  font-size: 12px;
}

/* ============ 5. 插件状态栏（底） ============ */
.plugin-status {
  display: flex;
  align-items: center;
  gap: 16px;
  flex: none;
  height: 30px;
  padding: 0 12px;
  border-top: 1px solid var(--divider-color, #e0e0e0);
  background: var(--card-background-color, #fff);
  font-size: 12px;
  color: var(--secondary-text-color, #888);
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

/* ============ 表单通用（右属性面板内复用） ============ */
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 16px;
}
.field > label {
  font-weight: 600;
  font-size: 13px;
}
.field small {
  color: var(--secondary-text-color, #888);
  font-size: 12px;
}
.inline-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 12px;
}
.inline-row label {
  font-size: 13px;
}
.w-full {
  width: 100%;
}

/* 表盘选择器卡片 */
.face-selector-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px;
  margin-bottom: 12px;
  border: 1px solid var(--divider-color, #e0e0e0);
  border-radius: 10px;
  background: var(--card-background-color, #f5f5f5);
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
  border: 1px solid var(--divider-color, #e0e0e0);
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
  color: var(--secondary-text-color, #888);
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
  color: var(--secondary-text-color, #888);
}
.layout-input {
  display: flex;
  align-items: center;
  gap: 6px;
}
.layout-input span {
  font-size: 12px;
  color: var(--secondary-text-color, #888);
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
