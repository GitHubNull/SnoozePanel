<script setup lang="ts">
/**
 * 方形经典表盘：方形机械腕表质感（品质标杆级）。
 *
 * 结构：多层金属表壳（外圈拉丝 + 倒角 + 内圈抛光）+
 *       内凹奶白表盘（径向渐变 + 日内瓦环形纹理 + 暗角）+
 *       立体金属时标（3/6/9/12 双方块 + 夜光点）+
 *       外圈分钟刻度环 + 镂空剑形指针（夜光内嵌 + 抛光高光）+
 *       纤细秒针 + 金质中心轴。
 *
 * 主题：midnight 用暖玫瑰金表壳；paper 用古铜金表壳。
 */
import { computed, useId } from 'vue';
import { clockHands } from '@/core/clock';
import type { FaceProps } from '../types';

const props = defineProps<FaceProps>();

const uid = useId();
const id = (name: string) => `${name}-${uid}`;

const hands = computed(() => clockHands(props.now));

/** 主题化金属调色板 */
const palette = computed(() =>
  props.theme.key === 'paper'
    ? {
        caseLight: '#e9cf96',
        caseMid: '#c69a54',
        caseDark: '#8a6432',
        caseEdge: '#7a5628',
        caseDeep: '#5a3d1e',
        mark: '#b98a4e',
        dialTop: '#fbf7ee',
        dialMid: '#f1e9d8',
        dialEdge: '#dccdb0',
        ink: '#3f3428',
        shadow: 'rgba(60, 45, 30, 0.4)',
        hand: '#c69a54',
        handEdge: '#8a6432',
        lume: '#fbe9c4',
        second: '#b3543a',
        secondTip: '#8b2020',
      }
    : {
        caseLight: '#e8c9a0',
        caseMid: '#c8876a',
        caseDark: '#8f5a41',
        caseEdge: '#7a4a33',
        caseDeep: '#4a2e1e',
        mark: '#e8c9a0',
        dialTop: '#faf6ec',
        dialMid: '#f3ede2',
        dialEdge: '#e4dbc8',
        ink: '#4a3f33',
        shadow: 'rgba(0, 0, 0, 0.5)',
        hand: '#c8876a',
        handEdge: '#7a4a33',
        lume: '#fbe9c4',
        second: '#5ea0ff',
        secondTip: '#8b2020',
      },
);

// 12 立体时标（3/6/9/12 为双方块）
const hourMarks = Array.from({ length: 12 }, (_, i) => ({
  angle: i * 30,
  double: i % 3 === 0,
}));

// 外圈分钟刻度（60 个）
const minuteTicks = Array.from({ length: 60 }, (_, i) => ({ angle: i * 6, major: i % 5 === 0 }));

// 表盘同心环形装饰纹理（日内瓦纹意象）
const dialRings = Array.from({ length: 13 }, (_, i) => 24 + i * 5);

/** 镂空剑形指针 path */
function skeletonSword(len: number, tail: number, w: number): string {
  const tip = `100,${100 - len}`;
  const tailY = 100 + tail;
  return [
    `M${tip}`,
    `L${100 + w},${100 - len * 0.35}`,
    `L${100 + w * 0.4},${tailY}`,
    `L${100 - w * 0.4},${tailY}`,
    `L${100 - w},${100 - len * 0.35}`,
    'Z',
  ].join(' ');
}

/** 夜光内嵌线 */
function lumeLine(len: number, tail: number): string {
  return `M100,${100 - len * 0.88} L100,${100 + tail * 0.5}`;
}

const hourHand = skeletonSword(50, 16, 7);
const minuteHand = skeletonSword(70, 18, 6);
const hourLume = lumeLine(50, 16);
const minuteLume = lumeLine(70, 18);
</script>

<template>
  <div class="face-square-classic" :style="{ filter: `drop-shadow(0 10px 32px ${palette.shadow})` }">
    <svg viewBox="0 0 200 200" aria-hidden="true">
      <defs>
        <!-- 表壳金属拉丝渐变（多段 stop 模拟拉丝反光） -->
        <linearGradient :id="id('case')" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" :stop-color="palette.caseLight" />
          <stop offset="22%" :stop-color="palette.caseMid" />
          <stop offset="48%" :stop-color="palette.caseDark" />
          <stop offset="72%" :stop-color="palette.caseMid" />
          <stop offset="100%" :stop-color="palette.caseDark" />
        </linearGradient>
        <!-- 表壳内侧暗部（营造内凹深度） -->
        <linearGradient :id="id('caseInner')" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" :stop-color="palette.caseDeep" stop-opacity="0.6" />
          <stop offset="30%" :stop-color="palette.caseDeep" stop-opacity="0.1" />
          <stop offset="70%" :stop-color="palette.caseDeep" stop-opacity="0.1" />
          <stop offset="100%" :stop-color="palette.caseDeep" stop-opacity="0.5" />
        </linearGradient>
        <!-- 镜面高光（左上） -->
        <linearGradient :id="id('gloss')" x1="0.08" y1="0" x2="0.78" y2="1">
          <stop offset="0%" stop-color="#ffffff" stop-opacity="0.42" />
          <stop offset="40%" stop-color="#ffffff" stop-opacity="0.06" />
          <stop offset="100%" stop-color="#ffffff" stop-opacity="0" />
        </linearGradient>
        <!-- 表盘奶白径向渐变 -->
        <radialGradient :id="id('dial')" cx="0.5" cy="0.42" r="0.78">
          <stop offset="0%" :stop-color="palette.dialTop" />
          <stop offset="68%" :stop-color="palette.dialMid" />
          <stop offset="100%" :stop-color="palette.dialEdge" />
        </radialGradient>
        <!-- 表盘边缘暗角 -->
        <radialGradient :id="id('vignette')" cx="0.5" cy="0.5" r="0.5">
          <stop offset="68%" stop-color="#000000" stop-opacity="0" />
          <stop offset="100%" stop-color="#000000" stop-opacity="0.18" />
        </radialGradient>
        <!-- 立体时标金属渐变 -->
        <linearGradient :id="id('mark')" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" :stop-color="palette.caseLight" />
          <stop offset="100%" :stop-color="palette.caseMid" />
        </linearGradient>
        <!-- 指针金属渐变 -->
        <linearGradient :id="id('hand')" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" :stop-color="palette.handEdge" />
          <stop offset="50%" :stop-color="palette.hand" />
          <stop offset="100%" :stop-color="palette.handEdge" />
        </linearGradient>
        <!-- 中心轴径向渐变 -->
        <radialGradient :id="id('pin')" cx="0.35" cy="0.3" r="0.8">
          <stop offset="0%" :stop-color="palette.caseLight" />
          <stop offset="60%" :stop-color="palette.hand" />
          <stop offset="100%" :stop-color="palette.handEdge" />
        </radialGradient>
      </defs>

      <!-- ═══ 表壳（4 层叠加营造立体感） ═══ -->
      <!-- 底层：金属拉丝主体 -->
      <rect x="4" y="4" width="192" height="192" rx="32" :fill="`url(#${id('case')})`" />
      <!-- 内侧暗部：内凹深度 -->
      <rect x="4" y="4" width="192" height="192" rx="32" :fill="`url(#${id('caseInner')})`" />
      <!-- 镜面高光 -->
      <rect x="4" y="4" width="192" height="192" rx="32" :fill="`url(#${id('gloss')})`" />
      <!-- 外沿倒角亮线 -->
      <rect x="4" y="4" width="192" height="192" rx="32" fill="none" :stroke="palette.caseLight" stroke-width="1" opacity="0.55" />
      <!-- 内沿倒角暗线 -->
      <rect x="12" y="12" width="176" height="176" rx="26" fill="none" :stroke="palette.caseEdge" stroke-width="1.2" opacity="0.7" />
      <!-- 内沿抛光亮线 -->
      <rect x="14" y="14" width="172" height="172" rx="24" fill="none" :stroke="palette.caseLight" stroke-width="0.4" opacity="0.3" />

      <!-- ═══ 内凹表盘 ═══ -->
      <rect x="18" y="18" width="164" height="164" rx="20" :fill="`url(#${id('dial')})`" />
      <!-- 日内瓦环形纹理 -->
      <g fill="none" :stroke="palette.ink" stroke-width="0.4" opacity="0.05">
        <circle v-for="r in dialRings" :key="r" cx="100" cy="100" :r="r" />
      </g>
      <!-- 表盘暗角 -->
      <rect x="18" y="18" width="164" height="164" rx="20" :fill="`url(#${id('vignette')})`" />
      <!-- 表盘内沿阴影线（增强内凹感） -->
      <rect x="18" y="18" width="164" height="164" rx="20" fill="none" :stroke="palette.caseDeep" stroke-width="1" opacity="0.25" />
      <rect x="20" y="20" width="160" height="160" rx="18" fill="none" :stroke="palette.caseLight" stroke-width="0.3" opacity="0.2" />

      <!-- ═══ 外圈分钟刻度环 ═══ -->
      <g>
        <line
          v-for="t in minuteTicks"
          :key="t.angle"
          x1="100" y1="24" :x2="100" :y2="t.major ? 30 : 27"
          :stroke="palette.ink" :stroke-width="t.major ? 1.3 : 0.6" :opacity="t.major ? 0.75 : 0.35"
          :transform="`rotate(${t.angle} 100 100)`"
        />
      </g>

      <!-- ═══ 立体时标（带夜光点） ═══ -->
      <g v-for="m in hourMarks" :key="m.angle" :transform="`rotate(${m.angle} 100 100)`">
        <!-- 时标阴影（营造浮起感） -->
        <template v-if="m.double">
          <rect x="93.5" y="34.5" width="5.5" height="11" rx="1" :fill="palette.caseDeep" opacity="0.3" />
          <rect x="101" y="34.5" width="5.5" height="11" rx="1" :fill="palette.caseDeep" opacity="0.3" />
          <rect x="93" y="34" width="5.5" height="11" rx="1" :fill="`url(#${id('mark')})`" :stroke="palette.caseEdge" stroke-width="0.5" />
          <rect x="100.5" y="34" width="5.5" height="11" rx="1" :fill="`url(#${id('mark')})`" :stroke="palette.caseEdge" stroke-width="0.5" />
          <!-- 夜光点 -->
          <circle cx="96" cy="44" r="1.2" :fill="palette.lume" opacity="0.7" />
          <circle cx="103.5" cy="44" r="1.2" :fill="palette.lume" opacity="0.7" />
        </template>
        <template v-else>
          <rect x="97" y="34.5" width="5.5" height="11" rx="1" :fill="palette.caseDeep" opacity="0.3" />
          <rect x="96.5" y="34" width="5.5" height="11" rx="1" :fill="`url(#${id('mark')})`" :stroke="palette.caseEdge" stroke-width="0.5" />
          <circle cx="99.5" cy="44" r="1.2" :fill="palette.lume" opacity="0.7" />
        </template>
      </g>

      <!-- ═══ 镂空剑形指针（夜光内嵌 + 抛光高光） ═══ -->
      <!-- 时针 -->
      <g :transform="`rotate(${hands.hour} 100 100)`">
        <path :d="hourHand" :fill="palette.hand" fill-opacity="0.28" :stroke="palette.hand" stroke-width="1.6" stroke-linejoin="round" />
        <path :d="hourLume" :stroke="palette.lume" stroke-width="1.6" stroke-linecap="round" opacity="0.55" />
        <path :d="hourHand" fill="none" :stroke="palette.caseLight" stroke-width="0.5" stroke-linejoin="round" opacity="0.5" />
      </g>
      <!-- 分针 -->
      <g :transform="`rotate(${hands.minute} 100 100)`">
        <path :d="minuteHand" :fill="palette.hand" fill-opacity="0.24" :stroke="palette.hand" stroke-width="1.4" stroke-linejoin="round" />
        <path :d="minuteLume" :stroke="palette.lume" stroke-width="1.3" stroke-linecap="round" opacity="0.5" />
        <path :d="minuteHand" fill="none" :stroke="palette.caseLight" stroke-width="0.45" stroke-linejoin="round" opacity="0.45" />
      </g>

      <!-- ═══ 秒针（纤细 + 末端深红圆点） ═══ -->
      <g v-if="seconds" :transform="`rotate(${hands.second} 100 100)`">
        <line x1="100" y1="112" x2="100" y2="26" :stroke="palette.second" stroke-width="1.2" stroke-linecap="round" />
        <circle cx="100" cy="32" r="2.4" :fill="palette.secondTip" />
      </g>

      <!-- ═══ 中心轴（金质 + 镜面点） ═══ -->
      <circle cx="100" cy="100" r="5" :fill="`url(#${id('pin')})`" />
      <circle cx="100" cy="100" r="5" fill="none" :stroke="palette.caseLight" stroke-width="0.5" opacity="0.6" />
      <circle cx="100" cy="100" r="2.2" :fill="palette.caseDeep" />
      <circle cx="99" cy="99" r="0.9" fill="#f4dcc0" opacity="0.85" />
    </svg>
  </div>
</template>

<style scoped>
.face-square-classic {
  width: clamp(220px, 48cqmin, 480px);
  height: clamp(220px, 48cqmin, 480px);
}
svg { width: 100%; height: 100%; display: block; }
</style>
