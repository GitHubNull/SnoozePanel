<script setup lang="ts">
/**
 * 组件包装器：统一处理屏保组件的定位、尺寸、字体颜色与编辑态拖拽/缩放。
 *
 * 非编辑态（editable=false）：
 *   - 绝对定位 left: x% top: y% width: w%（h 可选）
 *   - 应用自定义字体颜色（color prop 覆盖主题色）
 *
 * 编辑态（editable=true）：
 *   - 渲染拖拽手柄（组件本体可拖动）与右下角缩放手柄
 *   - 实时 emit update:layout，供编辑器预览画布同步配置
 */
import { computed, ref, onMounted, onBeforeUnmount, watch } from 'vue';
import type { ComponentLayout } from '@/core/types';
import { makeDraggable, makeResizable, type Cleanup } from '@/runtime/drag';

const props = withDefaults(
  defineProps<{
    /** 布局（百分比坐标 + 尺寸） */
    layout: ComponentLayout;
    /** 是否编辑态（显示拖拽/缩放手柄） */
    editable?: boolean;
    /** 自定义字体颜色（覆盖主题色） */
    color?: string;
    /** 组件唯一标识（编辑态辅助） */
    compKey?: string;
    /** 内容缩放的「1x」基准宽度（%）：布局宽 w 与之的比值即缩放比 */
    baseWidth?: number;
  }>(),
  {
    editable: false,
    color: undefined,
    compKey: '',
    baseWidth: 50,
  },
);

const emit = defineEmits<{
  (e: 'update:layout', layout: ComponentLayout): void;
}>();

const root = ref<HTMLElement | null>(null);
const resizeHandle = ref<HTMLElement | null>(null);

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

function setupGestures(): void {
  if (!props.editable || !root.value) return;
  const container = root.value.parentElement;
  if (!container) return;

  dragCleanup = makeDraggable(root.value, container, {
    onMove(x, y) {
      localLayout.value = { ...localLayout.value, x, y };
    },
    onEnd(x, y) {
      localLayout.value = { ...localLayout.value, x, y };
      emit('update:layout', { ...localLayout.value });
    },
  });

  if (resizeHandle.value) {
    // lockAspect=true：等比缩放，任意方向拖拽手柄都能均匀放大/缩小
    resizeCleanup = makeResizable(resizeHandle.value, root.value, container, {
      onResize(w, h) {
        // 高度自适应（h<=0）时保持不写 h，继续交由内容自适应
        localLayout.value = { ...localLayout.value, w, ...(h > 0 ? { h } : {}) };
      },
      onEnd(w, h) {
        localLayout.value = { ...localLayout.value, w, ...(h > 0 ? { h } : {}) };
        emit('update:layout', { ...localLayout.value });
      },
    }, true);
  }
}

function teardownGestures(): void {
  if (dragCleanup) {
    dragCleanup();
    dragCleanup = null;
  }
  if (resizeCleanup) {
    resizeCleanup();
    resizeCleanup = null;
  }
}

onMounted(() => {
  setupGestures();
});

onBeforeUnmount(() => {
  teardownGestures();
});

watch(
  () => props.editable,
  (next) => {
    teardownGestures();
    if (next) {
      // 等待 DOM 更新后重新绑定
      void Promise.resolve().then(() => setupGestures());
    }
  },
);
</script>

<template>
  <div
    ref="root"
    class="component-wrapper"
    :class="{ editable }"
    :style="wrapperStyle"
    :data-comp-key="compKey"
  >
    <!--
      内容层：整体按缩放比围绕中心等比缩放。
      虚线框与缩放手柄都依附于此层（而非定位壳），因此「虚线框 ≡ 组件内容边界」，
      无论放大到多大都不会出现虚线框小于组件的情况。
    -->
    <div class="component-content" :style="contentStyle">
      <slot />
      <!-- 编辑态：右下角缩放手柄（拖拽等比缩放；不设为 aria-hidden，纳入可访问性树以便定位） -->
      <button
        v-if="editable"
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

/* 内容层：承载 transform: scale() 等比缩放；虚线框与缩放手柄均依附于此层，
   使虚线框恒等于组件内容边界（放大到任意程度都不会小于组件） */
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

/* 编辑态虚线框：画在内容层而非定位壳，随内容一起缩放，故始终包裹组件 */
.component-wrapper.editable .component-content {
  outline: 1.5px dashed rgba(94, 160, 255, 0.55);
  outline-offset: 4px;
  border-radius: 4px;
}

.component-wrapper.editable .component-content:hover {
  outline-color: rgba(94, 160, 255, 0.9);
  background: rgba(94, 160, 255, 0.06);
}

/* 缩放手柄：吸附于虚线框右下角（与 outline-offset 对齐），
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
