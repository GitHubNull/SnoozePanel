<script setup lang="ts">
/**
 * 组件包装器：统一处理屏保组件的定位、尺寸、字体颜色与编辑态拖拽/缩放。
 *
 * 非编辑态（editable=false）：
 *   - 绝对定位 left: x% top: y% width: w%（h 可选）
 *   - 应用自定义字体颜色（color prop 覆盖主题色）
 *
 * 编辑态（editable=true）：
 *   - pointerdown 即 emit select，供编辑器左右面板点选联动
 *   - 仅选中组件显示实线高亮框与右下角缩放手柄；未选中为悬停浅虚线
 *   - snap 开启时，组件「可见边缘」靠近网格线（阈值内）才吸附并 emit guide 显示对齐参考线；
 *     远离网格线时自由移动、不显示参考线（避免参考线无脑常显）
 */
import { computed, ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue';
import type { ComponentLayout } from '@/core/types';
import { makeDraggable, makeResizable, snapEdges, type Cleanup } from '@/runtime/drag';

const props = withDefaults(
  defineProps<{
    /** 布局（百分比坐标 + 尺寸） */
    layout: ComponentLayout;
    /** 是否编辑态（显示拖拽/缩放手柄） */
    editable?: boolean;
    /** 是否选中（选中才显示实线高亮框与缩放手柄） */
    selected?: boolean;
    /** 磁吸附开关（编辑态生效） */
    snap?: boolean;
    /** 网格吸附步长（百分比，>0 且 snap 开启时生效） */
    gridStep?: number;
    /** 自定义字体颜色（覆盖主题色） */
    color?: string;
    /** 组件唯一标识（编辑态辅助） */
    compKey?: string;
    /** 内容缩放的「1x」基准宽度（%）：布局宽 w 与之的比值即缩放比 */
    baseWidth?: number;
    /** 图层序（写入 z-index；缺省不设置） */
    zIndex?: number;
  }>(),
  {
    editable: false,
    selected: false,
    snap: false,
    gridStep: 0,
    color: undefined,
    compKey: '',
    baseWidth: 50,
    zIndex: undefined,
  },
);

const emit = defineEmits<{
  (e: 'update:layout', layout: ComponentLayout): void;
  /** 编辑态点选组件；additive=true 表示 Ctrl/Cmd/Shift 多选（切换选中） */
  (e: 'select', compKey: string, additive: boolean): void;
  /** 吸附参考线：x 为纵向线位置（%），y 为横向线位置（%）；null 表示不显示 */
  (e: 'guide', guide: { x: number | null; y: number | null }): void;
}>();

const root = ref<HTMLElement | null>(null);
const resizeHandle = ref<HTMLElement | null>(null);
const contentEl = ref<HTMLElement | null>(null);

// 本地布局副本（编辑态拖拽中实时更新，拖动结束后 emit）
const localLayout = ref<ComponentLayout>({ ...props.layout });

watch(
  () => props.layout,
  (next) => {
    localLayout.value = { ...next };
  },
  { deep: true },
);

const wrapperStyle = computed(() => {
  const l = localLayout.value;
  const style: Record<string, string> = {
    position: 'absolute',
    left: `${l.x}%`,
    top: `${l.y}%`,
    width: `${l.w}%`,
    transform: 'translate(-50%, -50%)',
  };
  if (l.h !== undefined) {
    style.height = `${l.h}%`;
  }
  if (props.color) {
    style.color = props.color;
  }
  if (props.zIndex !== undefined) {
    style.zIndex = String(props.zIndex);
  }
  return style;
});

/**
 * 内容缩放比：布局宽度 w 与「1x」基准宽度的比值（基准宽度时=1）。
 * 基于本地布局副本实时计算，故拖动缩放手柄时内容立即等比放大/缩小。
 */
const scale = computed(() => {
  const base = props.baseWidth > 0 ? props.baseWidth : 50;
  const w = localLayout.value.w;
  return w > 0 ? w / base : 1;
});

/** 内容层内联样式：整体等比缩放（缩放比为 1 时不产生任何位移或形变）。 */
const contentStyle = computed(() => ({ transform: `scale(${scale.value})` }));

/**
 * 缩放手柄的反向缩放比：抵消内容层缩放，使手柄在屏幕上恒为 16px，
 * 这样组件缩到很小时手柄依然能稳定抓取，放大时手柄也不会跟着变成巨块。
 */
const handleScale = computed(() => {
  const s = scale.value;
  return s > 0 ? 1 / s : 1;
});

// ---- 编辑态拖拽/缩放 ----
let dragCleanup: Cleanup | null = null;
let resizeCleanup: Cleanup | null = null;
let selectListener: ((ev: PointerEvent) => void) | null = null;
/** 缩放手势开始时的布局宽度（%）：用于把指针像素换算为边缘位移阈值 */
let resizeStartW = 0;

/** 当前吸附步长（未开启吸附时为 0，交给 snapEdges 原样返回不吸附） */
function snapStep(): number {
  return props.snap && props.gridStep > 0 ? props.gridStep : 0;
}

/**
 * 吸附触发阈值相对网格步长的比例上限。
 * 必须远小于 0.5：进入吸附区后组件会「粘」在网格线上、不再跟随指针，
 * 只有该比例足够小、吸附区只占少数，用户才能顺畅地「拖过去」而不像撞墙卡死。
 * 0.15 时吸附区最多约占每格行程的 30%、自由区约 70%。
 */
const SNAP_RATIO = 0.15;

/**
 * 磁力半径（屏幕像素）：组件「可见边缘」距网格线在此像素距离内才吸附并显示参考线。
 * 以像素（而非百分比）衡量，使不同画布尺寸/网格步长下的吸附手感一致；
 * 再与「步长比例上限」取较小者，避免步长很小时吸附区吞掉整格而拖不动。
 */
const SNAP_REACH_PX = 15;

/**
 * 手势开始时的几何量测：以「可见内容盒」（高亮框所在的缩放层）为组件真实边界。
 * 内容盒恒以布局中心 (x, y) 为中心，故边缘 = 中心 ± 半宽/半高；
 * kx = 内容盒宽度(%) / 布局宽度 w，用于缩放吸附时把边缘位移换算回 dw。
 */
let geom = { halfW: 0, halfH: 0, kx: 1, cw: 0, ch: 0 };

function measureGeometry(): void {
  const container = root.value?.parentElement;
  const content = contentEl.value;
  if (!container || !content) return;
  const cr = container.getBoundingClientRect();
  const sr = content.getBoundingClientRect();
  if (cr.width <= 0 || cr.height <= 0) return;
  const w = localLayout.value.w;
  geom = {
    halfW: (sr.width / 2 / cr.width) * 100,
    halfH: (sr.height / 2 / cr.height) * 100,
    kx: w > 0 ? (sr.width / cr.width) * 100 / w : 1,
    cw: cr.width,
    ch: cr.height,
  };
}

/**
 * 单轴吸附触发阈值（%）：取「磁力半径像素」与「步长比例上限」中的较小者。
 * 用像素定上限可让手感不随画布尺寸漂移；用比例封顶则保证短画布/小步长时也留有自由区。
 */
function thresholdFor(axisSizePx: number, step: number): number {
  const byPx = axisSizePx > 0 ? (SNAP_REACH_PX / axisSizePx) * 100 : Infinity;
  return Math.min(byPx, step * SNAP_RATIO);
}

const clamp01 = (v: number): number => Math.min(100, Math.max(0, v));
const clampSize = (v: number): number => Math.min(100, Math.max(5, v));

/**
 * 拖拽吸附：按可见内容盒的左/右缘、上/下缘分别吸附到最近网格线。
 * 返回吸附后的中心坐标与命中的参考线（未命中为 null，即自由移动、不显示参考线）。
 */
function snapMove(x: number, y: number): { x: number; y: number; gx: number | null; gy: number | null } {
  const step = snapStep();
  if (!(step > 0)) return { x, y, gx: null, gy: null };
  const sx = snapEdges([x - geom.halfW, x + geom.halfW], step, thresholdFor(geom.cw, step));
  const sy = snapEdges([y - geom.halfH, y + geom.halfH], step, thresholdFor(geom.ch, step));
  return { x: clamp01(x + sx.delta), y: clamp01(y + sy.delta), gx: sx.line, gy: sy.line };
}

/**
 * 缩放吸附：按可见内容盒的右缘吸附到最近网格线，返回吸附后的宽度与命中的参考线。
 * 内容盒宽度 ∝ w，故 d(右缘)/dw = kx/2 → dw = delta / (kx/2)。
 *
 * 关键：右缘随指针的「增益」极低（= (kx/2)·startW/容器宽，%/每像素），
 * 若直接用「步长比例」阈值，吸附区在宽度维度会被放大成极大的一段（可达数百像素），
 * 表现为缩放时「碰到网格线就拖不动」。故此处阈值改用指针像素口径换算，
 * 使「粘滞段」恒为约 2×磁力半径像素，拖一下就脱开。
 */
function snapResizeWidth(w: number): { w: number; gx: number | null } {
  const step = snapStep();
  if (!(step > 0) || geom.kx <= 0) return { w, gx: null };
  // 边缘增益（%）/像素：d(右缘) = (kx/2)·d(dw)，而 d(dw) = startW/cw·d(指针)
  const gainPerPx = (geom.kx / 2) * (geom.cw > 0 ? resizeStartW / geom.cw : 0);
  const thr = Math.min(gainPerPx * SNAP_REACH_PX, step * SNAP_RATIO);
  const rightEdge = localLayout.value.x + (geom.kx * w) / 2;
  const s = snapEdges([rightEdge], step, thr);
  if (s.line === null) return { w, gx: null };
  return { w: clampSize(w + s.delta / (geom.kx / 2)), gx: s.line };
}

/**
 * 绑定拖拽手势（点选 + 移动）。
 * 与 selected 无关，故点选导致选中态变化时不重建——否则会在拖拽途中拆除监听，
 * 使「先点选未选中组件再拖动」的首次拖动丢失。
 */
function setupDrag(): void {
  if (!props.editable || !root.value) return;
  const container = root.value.parentElement;
  if (!container) return;

  if (!selectListener) {
    // 编辑态点选：pointerdown 即选中（缩放手柄的 pointerdown 已 stopPropagation，不会误触）
    // Ctrl / Cmd / Shift 按下时为「增量多选」，交由上层在切换/替换选中间抉择
    selectListener = (ev: PointerEvent) => {
      if (props.compKey) {
        emit('select', props.compKey, ev.ctrlKey || ev.metaKey || ev.shiftKey);
      }
    };
    root.value.addEventListener('pointerdown', selectListener);
  }

  if (!dragCleanup) {
    dragCleanup = makeDraggable(root.value, container, {
      onStart() {
        measureGeometry();
      },
      onMove(x, y) {
        const s = snapMove(x, y);
        localLayout.value = { ...localLayout.value, x: s.x, y: s.y };
        emit('guide', { x: s.gx, y: s.gy });
      },
      onEnd(x, y) {
        const s = snapMove(x, y);
        localLayout.value = { ...localLayout.value, x: s.x, y: s.y };
        emit('update:layout', { ...localLayout.value });
        emit('guide', { x: null, y: null });
      },
    });
  }
}

function teardownDrag(): void {
  if (selectListener && root.value) {
    root.value.removeEventListener('pointerdown', selectListener);
  }
  selectListener = null;
  if (dragCleanup) {
    dragCleanup();
    dragCleanup = null;
  }
}

/** 绑定缩放手势（缩放手柄仅在选中时渲染，故需按选中态与 DOM 更新时机重建） */
function setupResize(): void {
  if (!props.editable || !root.value || !resizeHandle.value) return;
  const container = root.value.parentElement;
  if (!container) return;
  if (resizeCleanup) return;

  // lockAspect=true：等比缩放，任意方向拖拽手柄都能均匀放大/缩小
  resizeCleanup = makeResizable(
    resizeHandle.value,
    root.value,
    container,
    {
      onStart() {
        measureGeometry();
        resizeStartW = localLayout.value.w;
      },
      onResize(w, h) {
        const s = snapResizeWidth(w);
        // 等比模式：按吸附后的宽度换算高度以维持长宽比；高度自适应（h<=0）时保持不写 h
        const nh = h > 0 && w > 0 ? (h / w) * s.w : h;
        localLayout.value = { ...localLayout.value, w: s.w, ...(nh > 0 ? { h: nh } : {}) };
        emit('guide', { x: s.gx, y: null });
      },
      onEnd(w, h) {
        const s = snapResizeWidth(w);
        const nh = h > 0 && w > 0 ? (h / w) * s.w : h;
        localLayout.value = { ...localLayout.value, w: s.w, ...(nh > 0 ? { h: nh } : {}) };
        emit('update:layout', { ...localLayout.value });
        emit('guide', { x: null, y: null });
      },
    },
    true,
  );
}

function teardownResize(): void {
  if (resizeCleanup) {
    resizeCleanup();
    resizeCleanup = null;
  }
}

onMounted(() => {
  setupDrag();
  setupResize();
});

onBeforeUnmount(() => {
  teardownDrag();
  teardownResize();
});

/** 编辑态开关变化：重建全部手势绑定 */
watch(
  () => props.editable,
  (next) => {
    teardownDrag();
    teardownResize();
    if (next) {
      // 等待 DOM 更新后重新绑定
      void nextTick(() => {
        setupDrag();
        setupResize();
      });
    }
  },
);

/** 选中态变化：仅重建缩放绑定（手柄条件渲染）；拖拽手势保持不动，避免打断首次拖动 */
watch(
  () => props.selected,
  () => {
    if (!props.editable) return;
    teardownResize();
    void nextTick(() => setupResize());
  },
);

/** 吸附参数变化：步长在绑定时被固化，需重建手势使磁吸开关/网格尺寸即时生效 */
watch(
  () => [props.snap, props.gridStep],
  () => {
    if (!props.editable) return;
    teardownDrag();
    teardownResize();
    void nextTick(() => {
      setupDrag();
      setupResize();
    });
  },
);
</script>

<template>
  <div
    ref="root"
    class="component-wrapper"
    :class="{ editable, selected }"
    :style="wrapperStyle"
    :data-comp-key="compKey"
  >
    <!--
      内容层：整体按缩放比围绕中心等比缩放。
      虚线框与缩放手柄都依附于此层（而非定位壳），因此「框 ≡ 组件内容边界」，
      无论放大到多大都不会出现框小于组件的情况。
    -->
    <div ref="contentEl" class="component-content" :style="contentStyle">
      <slot />
      <!-- 编辑态：仅选中时显示右下角缩放手柄（拖拽等比缩放） -->
      <button
        v-if="editable && selected"
        ref="resizeHandle"
        type="button"
        class="resize-handle"
        aria-label="拖拽调整组件尺寸"
        :style="{ transform: `translate(-50%, -50%) scale(${handleScale})` }"
      ></button>
    </div>
  </div>
</template>

<style scoped>
.component-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  /* 内容自适应：组件内部用 clamp/vmin 控制字号，wrapper 只负责定位与尺寸 */
  pointer-events: auto;
}

/* 内容层：承载 transform: scale() 等比缩放；框与缩放手柄均依附于此层，
   使框恒等于组件内容边界（放大到任意程度都不会小于组件） */
.component-content {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  will-change: transform;
}

.component-wrapper.editable {
  cursor: move;
  touch-action: none;
}

/* 编辑态未选中：透明框占位，悬停时显示浅虚线 */
.component-wrapper.editable .component-content {
  outline: 1.5px dashed transparent;
  outline-offset: 4px;
  border-radius: 4px;
}
.component-wrapper.editable:not(.selected):hover .component-content {
  outline-color: rgba(94, 160, 255, 0.5);
  background: rgba(94, 160, 255, 0.05);
}

/* 编辑态选中：实线高亮框 */
.component-wrapper.editable.selected .component-content {
  outline: 2px solid var(--primary-color, #5ea0ff);
  outline-offset: 4px;
  background: rgba(94, 160, 255, 0.08);
}

/* 缩放手柄：吸附于框右下角（与 outline-offset 对齐），
   并以 translate(-50%,-50%) 把中心对齐到角点；反向缩放抵消内容层缩放后屏幕尺寸恒为 16px */
.resize-handle {
  position: absolute;
  left: calc(100% + 4px);
  top: calc(100% + 4px);
  width: 16px;
  height: 16px;
  padding: 0;
  border-radius: 50%;
  background: var(--primary-color, #5ea0ff);
  border: 2px solid #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.35);
  cursor: nwse-resize;
  touch-action: none;
  z-index: 10;
  appearance: none;
  -webkit-appearance: none;
}
</style>
