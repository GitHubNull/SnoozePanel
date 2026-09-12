<script setup lang="ts">
/**
 * 独立「模拟设备显示面板」：按目标设备尺寸（模拟视口）渲染屏保，再等比缩放适配可用区。
 *
 * 语义等价 Chrome DevTools 设备模拟：屏幕区（.device-screen）的布局尺寸恒为目标设备
 * CSS 像素（screen.width × screen.height），屏保根 .snoozepanel 以 container-type:size
 * 作为容器，使表盘/组件的 cqmin/cqw 按设备视口解析——与真机逐像素一致。
 * 缩放仅作用于视觉（transform），不改变容器查询解析，故编辑态拖拽/缩放数学自洽。
 *
 * 机身外框（.device-body）：在屏幕四周包裹一层金属边框，模拟真实设备平放桌面的俯视效果；
 * 边框厚度/圆角随设备形态（手表/手机/平板）变化，屏幕区尺寸不受影响。
 *
 * 可独立存在：只需宿主给出可用区尺寸，机身尺寸完全由 screen 决定，不依赖宿主布局；
 * screen 变化（切换预设 / 配置重载）时自动重算缩放（自适应当前配置的屏幕尺寸）。
 * 屏保 now/hass 经 inject('snoozeState') 获取（编辑器与独立挂载均需 provide 该状态）。
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch, type CSSProperties } from 'vue';
import type { SnoozeConfig, ComponentLayout } from '@/core/types';
import { presetById, type ScreenSize } from '@/core/screen';
import ScreensaverApp from '@/ui/ScreensaverApp.vue';
import ScreenRulers from '@/ui/components/ScreenRulers.vue';
import type { RulerUnit } from '@/core/ruler';

const props = withDefaults(
  defineProps<{
    /** 编辑草稿（屏保按此渲染） */
    config: SnoozeConfig;
    /** 预览设备 id（展示用） */
    deviceId: string;
    /** 目标设备屏幕尺寸（模拟视口） */
    screen: ScreenSize;
    /** 画布网格只读快照（透传给 ScreensaverApp） */
    grid?: { show: boolean; snap: boolean; step: number };
    /** 当前选中组件 key 列表（编辑态，支持多选） */
    selectedKeys?: string[];
    /** 是否编辑态（透传给 ScreensaverApp） */
    editMode?: boolean;
    /** 受控缩放模式（提供即受控，编辑器路径由外层工具条驱动；缺省则用内部适配/1:1 切换） */
    zoomMode?: 'fit' | 'percent';
    /** 受控缩放百分比（仅 zoomMode='percent' 且受控时生效） */
    zoomPercent?: number;
    /** 外挂标尺（仅 editMode 且 show 时渲染，随预览缩放） */
    rulers?: { show: boolean; unit: RulerUnit };
  }>(),
  {
    grid: () => ({ show: true, snap: true, step: 5 }),
    selectedKeys: () => [],
    editMode: true,
    // 缺省即未受控：显式给出 undefined 默认值，触发内部适配/1:1 逻辑
    zoomMode: undefined,
    zoomPercent: undefined,
    // 缺省不显示标尺（dev 独立挂载 / 生产屏保不受影响）
    rulers: () => ({ show: false, unit: 'px' }),
  },
);

const emit = defineEmits<{
  (e: 'update:layout', compKey: string, layout: ComponentLayout): void;
  (e: 'select', compKey: string, additive: boolean): void;
}>();

const stageEl = ref<HTMLElement | null>(null);
/** 适配（contain）缩放比（仅 fit 模式消费） */
const fitScale = ref(1);
/** 未受控时的内部模式（standalone / dev 兼容）：true=适配 */
const internalFit = ref(true);
/** 是否受控：外部传入 zoomMode 即受控（编辑器路径），缩放由外层工具条驱动 */
const controlled = computed(() => props.zoomMode !== undefined);
/** 有效模式：受控取 props，否则取内部状态 */
const mode = computed<'fit' | 'percent'>(() =>
  controlled.value ? (props.zoomMode as 'fit' | 'percent') : internalFit.value ? 'fit' : 'percent',
);
/** 有效缩放百分比（percent 模式消费；未受控内部固定 100%） */
const percent = computed<number>(() => {
  if (!controlled.value) return 100;
  const p = Number(props.zoomPercent);
  return Number.isFinite(p) && p > 0 ? p : 100;
});
/** 生效缩放比：fit 用 contain 比，percent 用固定百分比（恒 >0） */
const effectiveScale = computed(() =>
  mode.value === 'fit' ? fitScale.value : Math.max(0.01, percent.value / 100),
);

/** 设备形态：决定机身外框质感——手表厚重圆润、手机窄边、平板方正 */
type DeviceKind = 'watch' | 'phone' | 'tablet';

/** 机身外框规格（设备 CSS px，随形态变化）：pad=边框厚度，outer/inner=内外圆角 */
interface BezelSpec {
  pad: number;
  outer: number;
  inner: number;
}
const BEZEL: Record<DeviceKind, BezelSpec> = {
  watch: { pad: 24, outer: 64, inner: 42 },
  phone: { pad: 13, outer: 52, inner: 38 },
  tablet: { pad: 18, outer: 30, inner: 14 },
};

/** 由预设 id 优先判定形态；自定义尺寸按几何推断 */
const kind = computed<DeviceKind>(() => {
  const p = props.screen.preset;
  if (p.startsWith('watch')) return 'watch';
  if (p.startsWith('phone')) return 'phone';
  if (p.startsWith('tablet')) return 'tablet';
  const { width: w, height: h } = props.screen;
  const max = Math.max(w, h);
  if (Math.abs(w - h) <= max * 0.12 && max <= 560) return 'watch';
  return h > w ? 'phone' : 'tablet';
});

const bezel = computed<BezelSpec>(() => BEZEL[kind.value]);
/** 机身总尺寸 = 屏幕尺寸 + 四周边框（俯视设备机身） */
const bodyW = computed(() => props.screen.width + bezel.value.pad * 2);
const bodyH = computed(() => props.screen.height + bezel.value.pad * 2);

/** 标尺槽厚度（设备 CSS px） */
const RULER_THICKNESS = 22;
/** 是否渲染标尺（仅编辑态且用户开启） */
const rulerOn = computed(() => props.editMode && props.rulers.show);
/** 外框包裹尺寸 = 机身 + 标尺槽（左侧 / 底部各预留一道） */
const frameW = computed(() => bodyW.value + (rulerOn.value ? RULER_THICKNESS : 0));
const frameH = computed(() => bodyH.value + (rulerOn.value ? RULER_THICKNESS : 0));

/**
 * 设备机身样式（俯视：金属外框 + 内嵌屏幕）：恒为设备像素尺寸，不承载整体缩放。
 * 机身在外框内绝对定位，左侧让出标尺槽；缩放由外层 .device-scaled（percent）
 * 或 .device-frame（fit）承载。外框厚度/内外圆角经 CSS 变量下发，按形态渲染。
 */
const bodyStyle = computed<CSSProperties>(() => {
  return {
    // 机身在外框内的绝对定位：左侧让出标尺槽（无标尺时为 0）
    position: 'absolute',
    left: `${rulerOn.value ? RULER_THICKNESS : 0}px`,
    top: '0px',
    width: `${bodyW.value}px`,
    height: `${bodyH.value}px`,
    '--bezel-pad': `${bezel.value.pad}px`,
    '--bezel-outer': `${bezel.value.outer}px`,
    '--bezel-inner': `${bezel.value.inner}px`,
  };
});

/**
 * 缩放层样式（包裹机身与标尺，使二者随预览同步缩放）。
 * fit 模式尺寸为自然外框尺寸，缩放由外框承载；
 * percent 模式以左上角为原点整体缩放（外框预留缩放后尺寸以支持滚动）。
 */
const scaledStyle = computed<CSSProperties>(() => {
  const base: CSSProperties = { width: `${frameW.value}px`, height: `${frameH.value}px` };
  if (mode.value === 'percent') {
    base.transform = `scale(${effectiveScale.value})`;
    base.transformOrigin = 'top left';
  }
  return base;
});

/**
 * 外框包裹层样式：承载整体缩放。
 * fit 模式以机身中心锚点居中 + 等比缩放（外框显式尺寸 = 机身 + 标尺槽）；
 * percent 模式预留缩放后尺寸（width/height），使缩放内容超出时可滚动。
 */
const frameStyle = computed<CSSProperties>(() => {
  if (mode.value === 'fit') {
    return {
      width: `${frameW.value}px`,
      height: `${frameH.value}px`,
      transform: `translate(-50%, -50%) scale(${effectiveScale.value})`,
    };
  }
  const s = effectiveScale.value;
  return { width: `${frameW.value * s}px`, height: `${frameH.value * s}px` };
});

/** 预设中文名（未命中视为自定义） */
const presetLabel = computed(() => presetById(props.screen.preset)?.label ?? '自定义');

/** 角标文案：预设名 · 宽×高 · 缩放说明 */
const labelText = computed(() => {
  const dims = `${props.screen.width}×${props.screen.height}`;
  const pct = Math.round(effectiveScale.value * 100);
  if (mode.value === 'fit') return `${presetLabel.value} · ${dims} · 适配 ${pct}%`;
  return `${presetLabel.value} · ${dims} · ${pct === 100 ? '1:1' : `缩放 ${pct}%`}`;
});

/** 重算适配缩放：可用区（扣除内边距）与机身总尺寸的 contain 比 */
function recompute(): void {
  const el = stageEl.value;
  if (!el) return;
  const pad = 18;
  const availW = el.clientWidth - pad * 2;
  const availH = el.clientHeight - pad * 2;
  const s = Math.min(availW / frameW.value, availH / frameH.value);
  fitScale.value = Number.isFinite(s) && s > 0 ? s : 1;
}

let observer: ResizeObserver | null = null;

onMounted(() => {
  void nextTick(recompute);
  // ResizeObserver 不可用时（旧环境/测试）退化为仅监听 window resize
  if (typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(() => recompute());
    if (stageEl.value) observer.observe(stageEl.value);
  }
  window.addEventListener('resize', recompute);
});

onBeforeUnmount(() => {
  observer?.disconnect();
  observer = null;
  window.removeEventListener('resize', recompute);
});

/** 目标尺寸/形态变化：机身自适应（自动跟随当前配置的屏幕尺寸） */
watch(
  () => [props.screen.width, props.screen.height, kind.value, rulerOn.value],
  () => void nextTick(recompute),
);

/** 切换显示模式后重算缩放（仅 fit 模式消费 fitScale） */
watch(mode, () => void nextTick(recompute));

function onLayoutUpdate(compKey: string, layout: ComponentLayout): void {
  emit('update:layout', compKey, layout);
}
function onSelect(compKey: string, additive: boolean): void {
  emit('select', compKey, additive);
}
/** 切换 适配 / 1:1（仅未受控时使用） */
function toggleFit(): void {
  internalFit.value = !internalFit.value;
}
</script>

<template>
  <div ref="stageEl" class="device-stage" :class="mode === 'fit' ? 'is-fit' : 'is-percent'">
    <!-- 外框包裹层：承载整体缩放（fit 居中缩放；percent 预留缩放后尺寸以支持滚动） -->
    <div class="device-frame" :class="{ 'is-fit': mode === 'fit' }" :style="frameStyle">
      <!-- 缩放层：包裹机身与标尺，使二者随预览同步缩放 -->
      <div class="device-scaled" :style="scaledStyle">
        <!-- 设备机身（俯视）：金属外框模拟真实设备外壳，内部为屏幕 -->
        <div class="device-body" :class="[`is-${kind}`]" :style="bodyStyle">
          <div class="device-screen">
            <ScreensaverApp
              :config="config"
              :device-id="deviceId"
              :grid="grid"
              :selected-keys="selectedKeys"
              :edit-mode="editMode"
              @update:layout="onLayoutUpdate"
              @select="onSelect"
            />
          </div>
          <!-- 玻璃反光（纯装饰，不拦截手势） -->
          <span class="device-glare" aria-hidden="true"></span>
        </div>

        <!-- 外挂标尺：编辑态 + 用户开启时显示，随预览一起缩放 -->
        <ScreenRulers
          v-if="rulerOn"
          :width="screen.width"
          :height="screen.height"
          :bezel-pad="bezel.pad"
          :thickness="RULER_THICKNESS"
          :unit="rulers.unit"
        />
      </div>
    </div>

    <!-- 显示模式切换（仅未受控时显示；编辑器由外层工具条驱动缩放） -->
    <button
      v-if="!controlled"
      type="button"
      class="device-fit-toggle"
      :title="mode === 'fit' ? '切换到 1:1 真实像素' : '切换到缩放适配'"
      aria-label="切换适配与 1:1 显示"
      @click="toggleFit"
    >{{ mode === 'fit' ? '1:1' : '适配' }}</button>

    <!-- 名称标识：预设名 · 尺寸 · 缩放比 -->
    <div class="device-label">{{ labelText }}</div>
  </div>
</template>

<style scoped>
.device-stage {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}
/* fit 模式：整体居中缩放，裁剪溢出 */
.device-stage.is-fit {
  overflow: hidden;
}
/* percent 模式：固定百分比缩放，超出可滚动；margin:auto 在 flex 内可靠居中 */
.device-stage.is-percent {
  display: flex;
  overflow: auto;
}
.device-stage.is-percent .device-frame {
  margin: auto;
  flex: none;
}

/* 外框包裹层：承载整体 transform 缩放（机身保持设备像素尺寸，容器查询解析不变） */
.device-frame {
  position: relative;
}
.device-frame.is-fit {
  position: absolute;
  left: 50%;
  top: 50%;
}

/* 缩放层：包裹机身与标尺；percent 模式下其自身被整体缩放，标尺因此与机身同步 */
.device-scaled {
  position: relative;
}

/*
 * 设备机身（俯视）：金属外框 + 内嵌屏幕，模拟真实设备平放桌面的效果。
 * 外框厚度/圆角由 --bezel-* 变量（随设备形态）驱动；padding 即边框厚度，
 * box-sizing:border-box 使内容区恰为屏幕尺寸（screen.width × screen.height），
 * 屏保 .snoozepanel 的容器查询仍按设备视口解析。
 */
.device-body {
  position: relative;
  box-sizing: border-box;
  padding: var(--bezel-pad);
  border-radius: var(--bezel-outer);
  background:
    linear-gradient(145deg, #9aa0aa 0%, #5d636d 16%, #2c3038 48%, #444a54 74%, #868c96 100%);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.35),
    inset 0 -1px 0 rgba(0, 0, 0, 0.5),
    0 0 0 1px rgba(0, 0, 0, 0.55),
    0 26px 48px -16px rgba(0, 0, 0, 0.78),
    0 10px 22px -10px rgba(0, 0, 0, 0.6);
}
/* 机身定位（含标尺槽偏移）由 bodyStyle 内联控制（fit / percent 通用，不再区分模式） */

/* 屏幕（玻璃面）：内圆角略小于外框，形成窄边框过渡；溢出裁剪以承载屏保 */
.device-screen {
  position: relative;
  width: 100%;
  height: 100%;
  border-radius: var(--bezel-inner);
  overflow: hidden;
  background: #000;
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.08),
    inset 0 0 24px rgba(0, 0, 0, 0.55);
}

/* 玻璃反光：左上斜向柔光，纯装饰不拦截手势 */
.device-glare {
  position: absolute;
  inset: var(--bezel-pad);
  border-radius: var(--bezel-inner);
  pointer-events: none;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.07) 0%, rgba(255, 255, 255, 0) 38%);
}

/* 手表：右侧表冠 */
.device-body.is-watch::after {
  content: '';
  position: absolute;
  top: 30%;
  right: calc(-1 * (var(--bezel-pad) - 6px));
  width: calc(var(--bezel-pad) - 6px);
  height: 18%;
  border-radius: 0 4px 4px 0;
  background: linear-gradient(180deg, #868c96, #34383f);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.3);
}

/* 手机：屏幕顶部居中灵动岛（纯装饰，不拦截手势） */
.device-body.is-phone .device-screen::after {
  content: '';
  position: absolute;
  top: 9px;
  left: 50%;
  transform: translateX(-50%);
  width: 26%;
  height: 14px;
  border-radius: 999px;
  background: #05070b;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.06);
  pointer-events: none;
}

.device-fit-toggle {
  position: absolute;
  right: 10px;
  top: 10px;
  z-index: 6;
  padding: 3px 10px;
  font-size: 11px;
  color: #e6ebf5;
  background: rgba(20, 24, 34, 0.82);
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 8px;
  cursor: pointer;
  backdrop-filter: blur(6px);
}
.device-fit-toggle:hover {
  background: rgba(40, 48, 66, 0.9);
}

.device-label {
  position: absolute;
  left: 50%;
  bottom: 8px;
  z-index: 5;
  transform: translateX(-50%);
  padding: 3px 10px;
  font-size: 11px;
  color: #cfd6e4;
  background: rgba(20, 24, 34, 0.72);
  border-radius: 999px;
  pointer-events: none;
  white-space: nowrap;
}
</style>
