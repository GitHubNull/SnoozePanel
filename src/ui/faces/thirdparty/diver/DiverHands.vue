<script setup lang="ts">
/**
 * 潜水表指针组：剑形时分针（夜光内嵌）+ 棒棒糖秒针 + 钢质中心帽。
 * 夜光内嵌线保证低光环境可读，秒针强调色设置提升运动感。
 */
import { computed } from 'vue';
import { clockHands } from '@/core/clock';
import type { DiverPalette } from './palette';

const props = defineProps<{
  /** 当前时间 */
  now: Date;
  /** 是否显示秒 */
  seconds: boolean;
  /** 调色板 */
  palette: DiverPalette;
}>();

const hands = computed(() => clockHands(props.now));

/** 剑形指针外轮廓（以 (100,100) 为轴，向上） */
function sword(len: number, w: number, tail: number): string {
  return [
    `M100,${100 - len}`,
    `L${100 + w},${100 - len * 0.55}`,
    `L${100 + w * 0.5},${100 + tail}`,
    `L${100 - w * 0.5},${100 + tail}`,
    `L${100 - w},${100 - len * 0.55}`,
    'Z',
  ].join(' ');
}

/** 夜光内嵌（略小于外轮廓） */
function swordLume(len: number, w: number, tail: number): string {
  return [
    `M100,${100 - len * 0.9}`,
    `L${100 + w * 0.5},${100 - len * 0.5}`,
    `L${100 + w * 0.2},${100 + tail * 0.4}`,
    `L${100 - w * 0.2},${100 + tail * 0.4}`,
    `L${100 - w * 0.5},${100 - len * 0.5}`,
    'Z',
  ].join(' ');
}

const hourSword = sword(42, 5.5, 12);
const minuteSword = sword(62, 4.5, 14);
const hourLume = swordLume(42, 5.5, 12);
const minuteLume = swordLume(62, 4.5, 14);
</script>

<template>
  <g class="diver-hands">
    <!-- 时针 -->
    <g :transform="`rotate(${hands.hour} 100 100)`">
      <path :d="hourSword" :fill="palette.steelLight" :stroke="palette.steelDark" stroke-width="0.5" stroke-linejoin="round" />
      <path :d="hourLume" :fill="palette.lume" />
    </g>
    <!-- 分针 -->
    <g :transform="`rotate(${hands.minute} 100 100)`">
      <path :d="minuteSword" :fill="palette.steelLight" :stroke="palette.steelDark" stroke-width="0.5" stroke-linejoin="round" />
      <path :d="minuteLume" :fill="palette.lume" />
    </g>
    <!-- 棒棒糖秒针 -->
    <g v-if="seconds" :transform="`rotate(${hands.second} 100 100)`">
      <line x1="100" y1="112" x2="100" y2="26" :stroke="palette.accent" stroke-width="1.4" stroke-linecap="round" />
      <circle cx="100" cy="38" r="5" :fill="palette.accent" />
      <circle cx="100" cy="38" r="2.6" :fill="palette.lume" opacity="0.9" />
      <circle cx="100" cy="112" r="2.6" :fill="palette.accent" />
    </g>
    <!-- 中心帽 -->
    <circle cx="100" cy="100" r="5" :fill="palette.steelMid" />
    <circle cx="100" cy="100" r="5" fill="none" :stroke="palette.steelLight" stroke-width="0.6" opacity="0.7" />
    <circle cx="100" cy="100" r="2.4" :fill="palette.accent" />
    <circle cx="99.2" cy="99.2" r="0.9" fill="#ffffff" opacity="0.8" />
  </g>
</template>
