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
  }>(),
  {
    editable: false,
    color: undefined,
    compKey: '',
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
    resizeCleanup = makeResizable(resizeHandle.value, root.value, container, {
      onResize(w, h) {
        localLayout.value = { ...localLayout.value, w, h };
      },
      onEnd(w, h) {
        localLayout.value = { ...localLayout.value, w, h };
        emit('update:layout', { ...localLayout.value });
      },
    });
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
    <slot />
    <!-- 编辑态：右下角缩放手柄 -->
    <div
      v-if="editable"
      ref="resizeHandle"
      class="resize-handle"
      aria-hidden="true"
    />
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

.component-wrapper.editable {
  cursor: move;
  touch-action: none;
  outline: 1.5px dashed rgba(94, 160, 255, 0.55);
  outline-offset: 2px;
  border-radius: 4px;
}

.component-wrapper.editable:hover {
  outline-color: rgba(94, 160, 255, 0.9);
  background: rgba(94, 160, 255, 0.06);
}

.resize-handle {
  position: absolute;
  right: -8px;
  bottom: -8px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--primary-color, #5ea0ff);
  border: 2px solid #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.35);
  cursor: nwse-resize;
  touch-action: none;
  z-index: 10;
}
</style>
