<script setup lang="ts">
/**
 * 表盘缩略预览：把「全屏舞台」整体缩放后放进任意尺寸的容器。
 *
 * 原理：所有表盘尺寸均使用 cqmin / cqw + clamp 容器单位，解析基准为其容器（.stage）。
 * 这里在 100vw×100vh 的舞台内按全屏方式完整渲染（与真实屏保逐像素一致），
 * 再对整个舞台施加 transform: scale 使其恰好 contain 进容器并居中。
 * 因此任意新增表盘无需任何适配即可获得预览能力。
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import type { Component } from 'vue';
import { facesVersion, getFace } from '@/ui/faces/registry';
import { getTheme } from '@/ui/themes';
import { Ticker } from '@/runtime/ticker';

const props = withDefaults(
  defineProps<{
    /** 表盘 id（未注册时回退默认表盘） */
    faceId: string;
    /** 主题：midnight（深色）/ paper（浅色） */
    theme: 'midnight' | 'paper';
    /** 是否显示秒（预览默认开，动效更直观） */
    seconds?: boolean;
    /** 是否 24 小时制 */
    hour24?: boolean;
    /** 是否绘制主题背景（与全屏屏保视觉一致） */
    showBackground?: boolean;
    /**
     * 放大系数：在「完整装入全屏」基础上再放大 zoom 倍，用于需要看清表盘细节的
     * 大预览（此时只显示表盘中心区域，超出容器部分被裁剪）。1 = 完整显示全屏画面。
     */
    zoom?: number;
    /** 表盘自定义配置透传（第三方表盘可读取） */
    options?: Record<string, unknown>;
  }>(),
  {
    seconds: true,
    hour24: true,
    showBackground: true,
    zoom: 1,
    options: () => ({}),
  },
);

const root = ref<HTMLElement | null>(null);
const now = ref(new Date());
/** contain 缩放比：使 100vw×100vh 舞台恰好装进容器 */
const scale = ref(0);

const faceComponent = computed<Component>(() => {
  void facesVersion.value; // 依赖注册表变更计数：运行时安装 / 卸载表盘后即时刷新
  return getFace(props.faceId).component;
});
const theme = computed(() => getTheme(props.theme));

/**
 * 舞台样式：left/top 50% 定位舞台左上角于容器中心 → translate(-50%,-50%) 把舞台
 * 中心拉回容器中心 → scale(s) 围绕舞台中心缩小；百分比 translate 基于舞台自身
 * 尺寸（100vw×100vh），与缩放互不干扰。
 */
const stageStyle = computed(() => ({
  transform: `translate(-50%, -50%) scale(${scale.value})`,
}));

/** 背景近似屏保主题底色（midnight → #0b1020，paper → #f5f1e8） */
const backdropStyle = computed(() => ({
  background: props.theme === 'paper' ? '#f5f1e8' : '#0b1020',
}));

let observer: ResizeObserver | null = null;
let ticker: Ticker | null = null;

/** 重算缩放比（窗口尺寸变化 / 容器尺寸变化时调用） */
function recomputeScale(): void {
  const el = root.value;
  if (!el) return;
  const vw = window.innerWidth || 1;
  const vh = window.innerHeight || 1;
  const s = Math.min(el.clientWidth / vw, el.clientHeight / vh) * props.zoom;
  scale.value = Number.isFinite(s) && s > 0 ? s : 0;
}

onMounted(() => {
  recomputeScale();
  // ResizeObserver 不可用时（旧环境/测试）退化为仅监听 window resize
  if (typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(() => recomputeScale());
    if (root.value) observer.observe(root.value);
  }
  window.addEventListener('resize', recomputeScale);
  // 1s tick 驱动时间（后台标签页自动暂停），与屏保内时钟一致
  ticker = new Ticker(() => {
    now.value = new Date();
  });
  ticker.watchVisibility();
  ticker.start();
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', recomputeScale);
  if (observer) {
    observer.disconnect();
    observer = null;
  }
  if (ticker) {
    ticker.destroy();
    ticker = null;
  }
});
</script>

<template>
  <div ref="root" class="face-preview">
    <div v-if="showBackground" class="backdrop" :style="backdropStyle"></div>
    <div class="stage" :style="stageStyle">
      <component
        :is="faceComponent"
        :now="now"
        :seconds="seconds"
        :hour24="hour24"
        :theme="theme"
        :options="options"
      />
    </div>
  </div>
</template>

<style scoped>
.face-preview {
  position: relative;
  overflow: hidden;
  /* 撑满调用方给定的容器（尺寸由宿主 CSS 决定），缩放比据此计算 */
  width: 100%;
  height: 100%;
  /* 预览纯展示，不拦截宿主交互（下拉选项点击等） */
  pointer-events: none;
}
.backdrop {
  position: absolute;
  inset: 0;
}
.stage {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 100vw;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  /* 尺寸容器：舞台即「视口参照」，表盘 cqmin/cqw 在此解析（100vw×100vh 下 cqmin === vmin）；
     舞台尺寸恰为窗口尺寸，故与生产全屏逐一像素一致。 */
  container-type: size;
  /* transform（translate + scale）由脚本注入 */
}
</style>
