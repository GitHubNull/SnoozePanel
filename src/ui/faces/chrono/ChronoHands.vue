<script setup lang="ts">
/**
 * 镂空指针组：机械计时码表的镂空剑形时针/分针 + 纤细秒针。
 * 指针用 path 绘制镂空菱形轮廓（边框玫瑰金、内部半透明），叠加夜光内嵌线与抛光高光，
 * 还原机械表的镂空工艺质感。
 */
import { computed } from 'vue';
import { clockHands } from '@/core/clock';

const props = defineProps<{
  now: Date;
  seconds: boolean;
  /** 指针主色（玫瑰金） */
  roseGold: string;
  /** 秒针色（亮金） */
  secondColor: string;
}>();

const hands = computed(() => clockHands(props.now));

/** 夜光内嵌色（与指针金属形成对比的暖米色） */
const LUME = '#fbe9c4';
const EDGE_LIGHT = '#f6ddba';

/**
 * 镂空剑形指针 path：以 (100,100) 为轴心，向上延伸。
 * @param len 针尖长度（距中心）
 * @param tail 针尾长度（反向）
 * @param w 针身最宽处半宽
 */
function skeletonHand(len: number, tail: number, w: number): string {
  const tip = `100,${100 - len}`;
  const tailY = 100 + tail;
  return [
    `M${tip}`,
    `L${100 + w},${100 - len * 0.35}`, // 右侧最宽
    `L${100 + w * 0.4},${tailY}`,       // 右尾
    `L${100 - w * 0.4},${tailY}`,       // 左尾
    `L${100 - w},${100 - len * 0.35}`, // 左侧最宽
    'Z',
  ].join(' ');
}

/** 夜光内嵌线：沿针身中线，略短于针尖 */
function lumeLine(len: number, tail: number): string {
  return `M100,${100 - len * 0.9} L100,${100 + tail * 0.5}`;
}

const hourHand = skeletonHand(52, 16, 7);
const minuteHand = skeletonHand(72, 18, 6);
const hourLume = lumeLine(52, 16);
const minuteLume = lumeLine(72, 18);
</script>

<template>
  <g class="hands">
    <!-- 时针（镂空 + 夜光内嵌 + 高光边） -->
    <g :transform="`rotate(${hands.hour} 100 100)`">
      <path :d="hourHand" :fill="roseGold" fill-opacity="0.26" :stroke="roseGold" stroke-width="1.6" stroke-linejoin="round" />
      <path :d="hourLume" :stroke="LUME" stroke-width="1.6" stroke-linecap="round" opacity="0.55" />
      <path :d="hourHand" fill="none" :stroke="EDGE_LIGHT" stroke-width="0.5" stroke-linejoin="round" opacity="0.5" />
    </g>
    <!-- 分针（镂空 + 夜光内嵌 + 高光边） -->
    <g :transform="`rotate(${hands.minute} 100 100)`">
      <path :d="minuteHand" :fill="roseGold" fill-opacity="0.22" :stroke="roseGold" stroke-width="1.4" stroke-linejoin="round" />
      <path :d="minuteLume" :stroke="LUME" stroke-width="1.3" stroke-linecap="round" opacity="0.5" />
      <path :d="minuteHand" fill="none" :stroke="EDGE_LIGHT" stroke-width="0.45" stroke-linejoin="round" opacity="0.45" />
    </g>
    <!-- 秒针（纤细 + 末端圆点 + 尾部配重） -->
    <g v-if="seconds" :transform="`rotate(${hands.second} 100 100)`">
      <line x1="100" y1="112" x2="100" y2="24" :stroke="secondColor" stroke-width="1.2" stroke-linecap="round" />
      <circle cx="100" cy="30" r="2.4" :fill="secondColor" />
      <circle cx="100" cy="112" r="1.8" :fill="secondColor" />
    </g>
    <!-- 中心轴（金质 + 镜面点） -->
    <circle cx="100" cy="100" r="4.5" :fill="roseGold" />
    <circle cx="100" cy="100" r="4.5" fill="none" :stroke="EDGE_LIGHT" stroke-width="0.5" opacity="0.6" />
    <circle cx="100" cy="100" r="2" fill="#1a120c" />
    <circle cx="99" cy="99" r="0.8" fill="#f4dcc0" opacity="0.8" />
  </g>
</template>
