<script setup lang="ts">
/**
 * 子表盘：机械计时码表上的小表盘（日期环 / 星期环）。
 * 外圈均布刻度线；labels 中非空项显示文字（空字符串 = 仅刻度，避免外圈文字拥挤）。
 * 中心一根带配重与高光的锥形指针指向当前值，角度变化带平滑过渡。
 */
import { computed, useId } from 'vue';

const props = defineProps<{
  /** 子表盘中心 x（viewBox 坐标） */
  cx: number;
  /** 子表盘中心 y */
  cy: number;
  /** 半径 */
  r: number;
  /** 各位置文字（沿外圈均布；空串表示该位置只画刻度不写文字） */
  labels: string[];
  /** 当前指针角度（度，0 指向正上方，顺时针） */
  angle: number;
  /** 文字/刻度色 */
  color: string;
  /** 指针色 */
  handColor: string;
  /** 字体族 */
  fontFamily: string;
}>();

const uid = useId();
const discId = `sd-disc-${uid}`;

// 每个位置的刻度线端点与文字坐标（文字保持正向可读）
const ticks = computed(() => {
  const count = props.labels.length;
  const rInner = props.r - 5.5;
  const rOuter = props.r - 1.2;
  const rText = props.r - 9.5;
  return props.labels.map((label, i) => {
    const a = (i / count) * 360;
    const rad = ((a - 90) * Math.PI) / 180;
    const cosv = Math.cos(rad);
    const sinv = Math.sin(rad);
    return {
      label,
      major: label !== '',
      x1: props.cx + rInner * cosv,
      y1: props.cy + rInner * sinv,
      x2: props.cx + rOuter * cosv,
      y2: props.cy + rOuter * sinv,
      tx: props.cx + rText * cosv,
      ty: props.cy + rText * sinv,
      rotate: a,
    };
  });
});

// 指针造型：针尖细、近轴宽、尾端短配重（以子表盘中心为旋转轴）
const handLen = computed(() => props.r - 9);
const handTail = 3.5;
const handPath = computed(
  () =>
    `M${props.cx},${props.cy - handLen.value} ` +
    `L${props.cx + 0.9},${props.cy} L${props.cx},${props.cy + handTail} ` +
    `L${props.cx - 0.9},${props.cy} Z`,
);

// 指针旋转：以 viewBox 坐标系中的子表盘中心为原点，带过渡实现平滑扫动
const handStyle = computed(() => ({
  transformBox: 'view-box' as const,
  transformOrigin: `${props.cx}px ${props.cy}px`,
  transform: `rotate(${props.angle}deg)`,
  transition: 'transform 0.5s cubic-bezier(0.22, 0.61, 0.36, 1)',
}));
</script>

<template>
  <g class="subdial">
    <defs>
      <!-- 凹嵌盘面：中心略暗、边缘收深，营造内凹感 -->
      <radialGradient :id="discId" cx="0.5" cy="0.45" r="0.7">
        <stop offset="0%" stop-color="rgba(26,18,12,0.34)" />
        <stop offset="72%" stop-color="rgba(26,18,12,0.52)" />
        <stop offset="100%" stop-color="rgba(12,8,5,0.72)" />
      </radialGradient>
    </defs>

    <!-- 子表盘底圈（内凹 + 外沿亮环） -->
    <circle :cx="cx" :cy="cy" :r="r" :fill="`url(#${discId})`" :stroke="handColor" stroke-width="0.8" opacity="0.95" />
    <circle :cx="cx" :cy="cy" :r="r - 1.1" fill="none" :stroke="color" stroke-width="0.35" opacity="0.35" />

    <!-- 刻度线与文字 -->
    <g v-for="(t, i) in ticks" :key="i">
      <line
        :x1="t.x1" :y1="t.y1" :x2="t.x2" :y2="t.y2"
        :stroke="color" :stroke-width="t.major ? 1 : 0.5" :opacity="t.major ? 0.95 : 0.4"
      />
      <text
        v-if="t.label"
        :x="t.tx" :y="t.ty"
        class="sd-label"
        :fill="color"
        :font-family="fontFamily"
        text-anchor="middle"
        dominant-baseline="central"
        :transform="`rotate(${t.rotate} ${t.tx} ${t.ty})`"
      >{{ t.label }}</text>
    </g>

    <!-- 小指针（带配重锥形 + 高光边 + 中心宝石） -->
    <g :style="handStyle">
      <path :d="handPath" :fill="handColor" />
      <path :d="handPath" fill="none" stroke="#f4dcc0" stroke-width="0.35" opacity="0.5" />
    </g>
    <circle :cx="cx" :cy="cy" r="1.9" :fill="handColor" />
    <circle :cx="cx" :cy="cy" r="0.9" fill="#f4dcc0" opacity="0.85" />
  </g>
</template>

<style scoped>
.sd-label {
  font-size: 6.4px;
  font-weight: 700;
  letter-spacing: 0.02em;
}
</style>
