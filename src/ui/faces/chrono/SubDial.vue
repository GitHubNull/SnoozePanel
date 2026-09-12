<script setup lang="ts">
/**
 * 子表盘：机械计时码表上的小表盘（日期环 / 星期环）。
 * 外圈均布刻度线；labels 中非空项显示文字（空字符串 = 仅刻度，避免外圈文字拥挤）。
 * 中心一根小指针指向当前值。
 */
import { computed } from 'vue';

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

// 每个位置的刻度线端点与文字坐标（文字保持正向可读）
const ticks = computed(() => {
  const count = props.labels.length;
  const rInner = props.r - 5;
  const rOuter = props.r - 1.5;
  const rText = props.r - 9;
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

// 指针终点
const handTip = computed(() => {
  const rad = ((props.angle - 90) * Math.PI) / 180;
  const len = props.r - 10;
  return { x: props.cx + len * Math.cos(rad), y: props.cy + len * Math.sin(rad) };
});
</script>

<template>
  <g class="subdial">
    <!-- 子表盘底圈 -->
    <circle :cx="cx" :cy="cy" :r="r" fill="rgba(26,18,12,0.5)" :stroke="handColor" stroke-width="0.7" opacity="0.92" />
    <!-- 刻度线与文字 -->
    <g v-for="(t, i) in ticks" :key="i">
      <line
        :x1="t.x1" :y1="t.y1" :x2="t.x2" :y2="t.y2"
        :stroke="color" :stroke-width="t.major ? 0.9 : 0.5" :opacity="t.major ? 0.9 : 0.45"
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
    <!-- 小指针 -->
    <line
      :x1="cx" :y1="cy" :x2="handTip.x" :y2="handTip.y"
      :stroke="handColor" stroke-width="1.6" stroke-linecap="round"
    />
    <circle :cx="cx" :cy="cy" r="2.2" :fill="handColor" />
  </g>
</template>

<style scoped>
.sd-label {
  font-size: 6px;
  font-weight: 700;
  letter-spacing: 0.02em;
}
</style>
