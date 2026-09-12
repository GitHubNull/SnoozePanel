<script setup lang="ts">
import { computed, ref, inject, onMounted, onBeforeUnmount, type Component } from 'vue';
import { baseWidthFor, type SnoozeConfig, type ComponentLayout } from '@/core/types';
import { getTheme } from './themes';
import { evalTemplate } from '@/core/template';
import type { HassLike } from '@/core/hass';
import { getFace } from './faces/registry';
import { getWidget } from './widgets/registry';
import ComponentWrapper from './components/ComponentWrapper.vue';

interface SnoozeState {
  now: Date;
  hass: HassLike;
}

const props = withDefaults(
  defineProps<{
    config: SnoozeConfig;
    deviceId: string;
    /** 是否编辑态（相对定位铺满宿主，显示拖拽/缩放手柄，供编辑器预览画布用） */
    editMode?: boolean;
    /** 画布网格与磁吸附偏好（仅编辑态生效） */
    grid?: { show: boolean; snap: boolean; step: number };
    /** 当前选中组件 key 列表（仅编辑态生效，与编辑器左右面板共用，支持多选） */
    selectedKeys?: string[];
  }>(),
  {
    editMode: false,
    grid: () => ({ show: true, snap: true, step: 5 }),
    selectedKeys: () => [],
  },
);

const emit = defineEmits<{
  (e: 'update:layout', compKey: string, layout: ComponentLayout): void;
  (e: 'select', compKey: string, additive: boolean): void;
}>();

// 响应式 now / hass 由 mount 层通过 provide 注入
const state = inject<SnoozeState>('snoozeState');
const now = computed(() => state?.now ?? new Date());
const hass = computed(() => state?.hass ?? ({ states: {} } as HassLike));

const theme = computed(() => getTheme(props.config.theme));

/**
 * 表盘生效主题：表盘内部将 theme.text / theme.textSecondary 以行内样式着色
 * （会覆盖 wrapper 的 color 继承），故这里把自定义字体颜色写回主题，
 * 使「字体颜色」对表盘（数字 / SVG 指针·刻度）同样生效；未设置时透传原主题。
 */
const clockTheme = computed(() => {
  const c = props.config.components.clock.color;
  if (!c) return theme.value;
  return { ...theme.value, text: c, textSecondary: c };
});

// 按表盘 id 动态解析入口组件（找不到回退默认表盘）
const faceComponent = computed(() => getFace(props.config.components.clock.style).component);

// ---- 背景轮播 ----
const bgIndex = ref(0);
let bgTimer: ReturnType<typeof setInterval> | null = null;

const bgImages = computed(() =>
  props.config.background.type === 'image' ? props.config.background.images : [],
);

onMounted(() => {
  if (bgImages.value.length > 1) {
    bgTimer = setInterval(() => {
      bgIndex.value = (bgIndex.value + 1) % bgImages.value.length;
    }, props.config.background.interval_seconds * 1000);
  }
});

onBeforeUnmount(() => {
  if (bgTimer !== null) clearInterval(bgTimer);
});

const backgroundStyle = computed(() => {
  const bg = props.config.background;
  if (bg.type === 'gradient') {
    return { background: `linear-gradient(${bg.gradient.angle}deg, ${bg.gradient.from}, ${bg.gradient.to})` };
  }
  if (bg.type === 'image' && bgImages.value.length > 0) {
    const url = bgImages.value[bgIndex.value % bgImages.value.length];
    return { backgroundImage: `url("${url}")`, backgroundSize: 'cover', backgroundPosition: 'center' };
  }
  return { background: bg.color };
});

// ---- 显隐模板 ----
const overallVisible = computed(() => evalTemplate(props.config.display_template, hass.value, true));

function compVisible(key: string, show: boolean): boolean {
  if (!show) return false;
  const tpl = props.config.component_templates[key];
  return evalTemplate(tpl, hass.value, true);
}

// ---- 组件清单（含类型 / 布局 / 颜色 / 选项） ----
interface PlacedComp {
  key: string;
  /** 内容组件类型 id：clock 走 faces 表盘，calendar/date/lunar/weather/text 走 widgets 注册表 */
  type: string;
  layout: ComponentLayout;
  color?: string;
  /** 该组件配置（内置字段 + 第三方 options），供 widget 消费 */
  options: Record<string, unknown>;
}

/** 渲染项：在清单项基础上带上解析后的 zIndex（layout.z 缺省按清单顺序） */
interface RenderedComp extends PlacedComp {
  zIndex: number;
}

const placedComponents = computed<PlacedComp[]>(() => {
  const c = props.config.components;
  const list: PlacedComp[] = [];
  if (compVisible('clock', c.clock.show)) {
    list.push({ key: 'clock', type: 'clock', layout: c.clock.layout, color: c.clock.color, options: {} });
  }
  if (compVisible('calendar', c.calendar.show)) {
    list.push({
      key: 'calendar',
      type: 'calendar',
      layout: c.calendar.layout,
      color: c.calendar.color,
      options: {
        week_start: c.calendar.week_start,
        show_week_number: c.calendar.show_week_number,
        format: c.calendar.format,
        ...c.calendar.options,
      },
    });
  }
  if (compVisible('date', c.date.show)) {
    list.push({
      key: 'date',
      type: 'date',
      layout: c.date.layout,
      color: c.date.color,
      options: { format: c.date.format, ...c.date.options },
    });
  }
  if (compVisible('lunar', c.lunar.show)) {
    list.push({
      key: 'lunar',
      type: 'lunar',
      layout: c.lunar.layout,
      color: c.lunar.color,
      options: { format: c.lunar.format, ...c.lunar.options },
    });
  }
  if (compVisible('weather', c.weather.show && !!c.weather.entity)) {
    list.push({
      key: 'weather',
      type: 'weather',
      layout: c.weather.layout,
      color: c.weather.color,
      options: { entity: c.weather.entity, ...c.weather.options },
    });
  }
  c.texts.forEach((t, i) => {
    // 每条自定义文本可独立显隐（show 缺省视为显示）
    if (compVisible(`text_${i}`, t.show !== false)) {
      list.push({
        key: `text_${i}`,
        type: 'text',
        layout: t.layout,
        color: t.color,
        options: { content: t.content, ...t.options },
      });
    }
  });
  return list;
});

/** 按 layout.z 升序渲染（z 缺省按清单顺序）；zIndex 传入 ComponentWrapper 控制堆叠 */
const renderComponents = computed<RenderedComp[]>(() =>
  placedComponents.value
    .map((item, i) => ({ ...item, zIndex: item.layout.z ?? i }))
    .sort((a, b) => a.zIndex - b.zIndex),
);

/** 按类型解析内容组件入口（找不到回退默认组件） */
function widgetComponent(type: string): Component {
  return getWidget(type).component;
}

function onLayoutUpdate(compKey: string, layout: ComponentLayout): void {
  emit('update:layout', compKey, layout);
}

/** 画布点选组件 → 透传给编辑器（additive=true 表示 Ctrl/Cmd/Shift 多选） */
function onSelect(compKey: string, additive: boolean): void {
  emit('select', compKey, additive);
}

// ---- 编辑态：网格叠加层与吸附参考线 ----
/** 吸附参考线状态（仅当组件边缘吸附命中时由子组件 emit 命中的网格线位置，结束时清空） */
const guide = ref<{ x: number | null; y: number | null }>({ x: null, y: null });

function onGuide(next: { x: number | null; y: number | null }): void {
  guide.value = next;
}

/**
 * 网格叠加层样式：双轴 1px 线 + background-size 随网格步长百分比自适应。
 * 无需 JS 重算——百分比尺寸会随画布尺寸自动伸缩。
 */
const gridStyle = computed(() => ({
  backgroundImage:
    'linear-gradient(to right, rgba(255,255,255,0.14) 1px, transparent 1px),' +
    'linear-gradient(to bottom, rgba(255,255,255,0.14) 1px, transparent 1px)',
  backgroundSize: `${props.grid.step}% ${props.grid.step}%`,
}));

const themeVars = computed(() => ({
  '--snooze-text': theme.value.text,
  '--snooze-text-secondary': theme.value.textSecondary,
  '--snooze-accent': theme.value.accent,
  fontFamily: theme.value.fontFamily,
  color: theme.value.text,
}));
</script>

<template>
  <div v-if="overallVisible" class="snoozepanel" :class="{ 'edit-mode': editMode }" :style="[backgroundStyle, themeVars]">
    <div class="dim" :style="{ background: `rgba(0,0,0,${config.background.dim})` }"></div>

    <!-- 编辑态网格叠加层（仅 editMode 渲染，生产屏保不出现；pointer-events:none 不挡交互） -->
    <div v-if="editMode && grid.show" class="grid-layer" :style="gridStyle"></div>

    <!-- 全部组件统一用 ComponentWrapper 渲染（自由布局 + 可选编辑态）；按 layout.z 升序堆叠 -->
    <ComponentWrapper
      v-for="item in renderComponents"
      :key="item.key"
      :layout="item.layout"
      :color="item.color"
      :z-index="item.zIndex"
      :editable="editMode"
      :selected="editMode && selectedKeys.includes(item.key)"
      :snap="grid.snap"
      :grid-step="grid.step"
      :comp-key="item.key"
      :base-width="baseWidthFor(item.key)"
      @update:layout="onLayoutUpdate(item.key, $event)"
      @select="onSelect"
      @guide="onGuide"
    >
      <!-- 时钟：仍走 faces 表盘注册表 -->
      <component
        :is="faceComponent"
        v-if="item.type === 'clock'"
        :now="now"
        :hour24="config.components.clock.hour24"
        :seconds="config.components.clock.seconds"
        :theme="clockTheme"
      />
      <!-- 内容组件：统一走 widgets 注册表动态挂载（calendar/date/lunar/weather/text） -->
      <component
        :is="widgetComponent(item.type)"
        v-else
        :now="now"
        :hass="hass"
        :theme="theme"
        :options="item.options"
        :color="item.color"
      />
    </ComponentWrapper>

    <!-- 编辑态吸附参考线（仅在组件边缘吸附命中时显示的对齐网格高亮线） -->
    <template v-if="editMode">
      <div v-if="guide.x !== null" class="guide-line guide-v" :style="{ left: guide.x + '%' }"></div>
      <div v-if="guide.y !== null" class="guide-line guide-h" :style="{ top: guide.y + '%' }"></div>
    </template>

    <!-- 设备 id 角落标识 -->
    <div class="device-id">{{ deviceId }}</div>
  </div>
</template>

<style scoped>
.snoozepanel {
  position: fixed;
  inset: 0;
  z-index: 9999;
  overflow: hidden;
  transition: opacity 0.4s ease;
  /* 设备模拟视口：建立尺寸容器，供组件/表盘的 cqmin/cqw 解析。
     生产全屏（inset:0）下 cqmin === vmin，观感与旧版逐像素一致；
     编辑器内由 DevicePreview 把本元素约束到目标设备尺寸，实现真机级缩放。 */
  container-type: size;
}
.snoozepanel.edit-mode {
  position: relative;
  inset: auto;
  z-index: auto;
  width: 100%;
  height: 100%;
}
.dim {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

/* 编辑态网格叠加层：双轴 1px 线按 background-size（= 步长%）平铺 */
.grid-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

/* 吸附参考线：高亮横/纵线，显示在组件之上 */
.guide-line {
  position: absolute;
  pointer-events: none;
  z-index: 15;
  background: var(--primary-color, #5ea0ff);
  box-shadow: 0 0 4px rgba(94, 160, 255, 0.8);
}
.guide-v {
  top: 0;
  bottom: 0;
  width: 1px;
  transform: translateX(-0.5px);
}
.guide-h {
  left: 0;
  right: 0;
  height: 1px;
  transform: translateY(-0.5px);
}
.device-id {
  position: absolute;
  right: 8px;
  bottom: 6px;
  font-size: 11px;
  opacity: 0.35;
  letter-spacing: 0.05em;
  user-select: text;
  z-index: 20;
}
</style>
