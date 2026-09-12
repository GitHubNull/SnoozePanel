<script setup lang="ts">
/**
 * 潜水表表圈：钢壳 + 陶瓷单向旋转表圈（0-60 分钟刻度 + 12 点夜光定位珠）。
 * 金属拉丝外壳、滚花边缘、穹面镜面高光，还原专业潜水表的工艺感。
 */
import { computed, useId } from 'vue';
import type { DiverPalette } from './palette';

defineProps<{
  /** 调色板 */
  palette: DiverPalette;
  /** 字体族 */
  fontFamily: string;
}>();

const uid = useId();
const id = (n: string) => `${n}-${uid}`;

// 滚花边缘短齿（外圈钢壳）
const knurl = Array.from({ length: 120 }, (_, i) => i * 3);

// 分钟刻度：60 个，每 5 分钟为大刻度
const ticks = computed(() =>
  Array.from({ length: 60 }, (_, i) => {
    const angle = i * 6;
    const major = i % 5 === 0;
    return { angle, major, rOuter: major ? 92 : 88.5 };
  }),
);

// 表圈数字：10/20/30/40/50 分钟处
const numbers = [10, 20, 30, 40, 50].map((m) => {
  const angle = m * 6;
  const rad = ((angle - 90) * Math.PI) / 180;
  const rText = 84;
  return { label: String(m), angle, x: 100 + rText * Math.cos(rad), y: 100 + rText * Math.sin(rad) };
});
</script>

<template>
  <g class="diver-bezel">
    <defs>
      <!-- 钢壳拉丝渐变 -->
      <linearGradient :id="id('steel')" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" :stop-color="palette.steelLight" />
        <stop offset="30%" :stop-color="palette.steelMid" />
        <stop offset="55%" :stop-color="palette.steelDark" />
        <stop offset="78%" :stop-color="palette.steelMid" />
        <stop offset="100%" :stop-color="palette.steelDark" />
      </linearGradient>
      <!-- 陶瓷表圈底渐变（穹面纵深） -->
      <radialGradient :id="id('ceramic')" cx="0.5" cy="0.34" r="0.72">
        <stop offset="0%" :stop-color="palette.bezelOuter" />
        <stop offset="72%" :stop-color="palette.bezelOuter" />
        <stop offset="100%" :stop-color="palette.bezelInner" />
      </radialGradient>
      <!-- 表圈穹面高光 -->
      <linearGradient :id="id('gloss')" x1="0.12" y1="0" x2="0.72" y2="1">
        <stop offset="0%" :stop-color="palette.bezelGloss" />
        <stop offset="46%" stop-color="#ffffff" stop-opacity="0.04" />
        <stop offset="100%" stop-color="#ffffff" stop-opacity="0" />
      </linearGradient>
    </defs>

    <!-- 钢壳 + 滚花边缘 -->
    <circle cx="100" cy="100" r="98" :fill="`url(#${id('steel')})`" />
    <circle cx="100" cy="100" r="98" fill="none" :stroke="palette.steelLight" stroke-width="0.8" opacity="0.5" />
    <g :stroke="palette.steelDark" stroke-width="0.5" opacity="0.5">
      <line
        v-for="a in knurl"
        :key="a"
        x1="100" y1="2.2" x2="100" y2="4.6"
        :transform="`rotate(${a} 100 100)`"
      />
    </g>

    <!-- 陶瓷表圈底 + 穹面高光 -->
    <circle cx="100" cy="100" r="95.5" :fill="`url(#${id('ceramic')})`" />
    <circle cx="100" cy="100" r="95.5" :fill="`url(#${id('gloss')})`" />
    <circle cx="100" cy="100" r="95.5" fill="none" :stroke="palette.bezelEdge" stroke-width="0.6" opacity="0.8" />

    <!-- 分钟刻度（76 → 92/88.5） -->
    <g>
      <line
        v-for="t in ticks"
        :key="t.angle"
        x1="100" y1="24" :x2="100" :y2="100 - t.rOuter"
        :stroke="palette.markerInk" :stroke-width="t.major ? 1.2 : 0.5" :opacity="t.major ? 0.95 : 0.55"
        :transform="`rotate(${t.angle} 100 100)`"
      />
    </g>

    <!-- 数字（保持正向可读） -->
    <text
      v-for="n in numbers"
      :key="n.label"
      :x="n.x" :y="n.y"
      class="bezel-num"
      :fill="palette.markerInk"
      :font-family="fontFamily"
      text-anchor="middle"
      dominant-baseline="central"
      :transform="`rotate(${n.angle} ${n.x} ${n.y})`"
    >{{ n.label }}</text>

    <!-- 12 点夜光定位珠 -->
    <polygon points="100,11.5 95.6,20 104.4,20" :fill="palette.lume" />
    <polygon points="100,11.5 95.6,20 104.4,20" fill="none" :stroke="palette.bezelEdge" stroke-width="0.4" opacity="0.6" />
    <!-- 内圈章节环 -->
    <circle cx="100" cy="100" r="73" fill="none" :stroke="palette.steelDark" stroke-width="1.2" opacity="0.7" />
  </g>
</template>

<style scoped>
.bezel-num {
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 0.02em;
}
</style>
