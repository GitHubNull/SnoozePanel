<script setup lang="ts">
/**
 * 机械计时码表表盘（品质标杆，截图同款）。
 *
 * 结构：拉丝玫瑰金表圈 + 奶白表盘 + 立体时标 + 外圈分钟刻度 +
 *       中央镂空窗（可见齿轮组）+ 左日期子表盘（1-31）+ 右星期子表盘（SUN-SAT）+
 *       镂空剑形时分针 + 纤细秒针。
 *
 * 配色：玫瑰金 #c8876a / 亮金 #e8c9a0 / 黄铜 #d4af37 / 奶白表盘。
 * 子组件：ChronoGears（齿轮组）/ SubDial（子表盘）/ ChronoHands（镂空指针组）。
 */
import { computed } from 'vue';
import { dateSubDialAngle, weekdaySubDialAngle } from '@/core/clock';
import type { FaceProps } from '../types';
import ChronoGears from './ChronoGears.vue';
import SubDial from './SubDial.vue';
import ChronoHands from './ChronoHands.vue';

const props = defineProps<FaceProps>();

// 配色（机械表金属质感，两主题下统一用暖金系，奶白表盘百搭）
const ROSE_GOLD = '#c8876a';
const ROSE_GOLD_LIGHT = '#e8c9a0';
const BRASS = '#d4af37';
const DIAL_BG = '#f3ede2';   // 奶白表盘
const DIAL_INK = '#4a3f33';  // 表盘文字/刻度深棕
const DARK = '#1a120c';      // 镂空深处

// 日期子表盘：31 天；仅 1/5/10…30 显示数字，其余为刻度线（避免外圈文字拥挤）
const dateLabels = Array.from({ length: 31 }, (_, i) => {
  const day = i + 1;
  return day === 1 || day % 5 === 0 ? String(day) : '';
});
// 星期子表盘：SUN..SAT（机械表常用英文缩写）
const weekLabels = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

const dateAngle = computed(() => dateSubDialAngle(props.now));
const weekAngle = computed(() => weekdaySubDialAngle(props.now));

// 立体时标：12 个，棒形（3/6/9/12 双方棒）+ 圆点交替，带轻微高光
const hourMarks = Array.from({ length: 12 }, (_, i) => ({
  angle: i * 30,
  square: i % 3 === 0, // 3/6/9/12 用方块立体时标
}));

// 外圈分钟刻度（60 个）
const minuteTicks = Array.from({ length: 60 }, (_, i) => ({ angle: i * 6, major: i % 5 === 0 }));
</script>

<template>
  <div class="face-chrono">
    <svg viewBox="0 0 200 200" aria-hidden="true">
      <defs>
        <!-- 表圈玫瑰金拉丝渐变 -->
        <linearGradient id="bezel" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" :stop-color="ROSE_GOLD_LIGHT" />
          <stop offset="45%" :stop-color="ROSE_GOLD" />
          <stop offset="100%" stop-color="#8f5a41" />
        </linearGradient>
        <!-- 表盘奶白径向渐变（中心略亮） -->
        <radialGradient id="dial" cx="0.5" cy="0.42" r="0.75">
          <stop offset="0%" stop-color="#faf6ec" />
          <stop offset="70%" :stop-color="DIAL_BG" />
          <stop offset="100%" stop-color="#e4dbc8" />
        </radialGradient>
        <!-- 立体时标高光 -->
        <linearGradient id="mark" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" :stop-color="ROSE_GOLD_LIGHT" />
          <stop offset="100%" :stop-color="ROSE_GOLD" />
        </linearGradient>
        <!-- 中央镂空窗暗场（中心略亮，露出齿轮） -->
        <radialGradient id="skeleton" cx="0.5" cy="0.45" r="0.6">
          <stop offset="0%" stop-color="#241813" />
          <stop offset="100%" :stop-color="DARK" />
        </radialGradient>
      </defs>

      <!-- 拉丝表圈 -->
      <circle cx="100" cy="100" r="98" fill="url(#bezel)" />
      <circle cx="100" cy="100" r="90" fill="none" stroke="#8f5a41" stroke-width="0.8" opacity="0.6" />

      <!-- 奶白表盘 -->
      <circle cx="100" cy="100" r="88" fill="url(#dial)" />

      <!-- 外圈分钟刻度环 -->
      <g>
        <line
          v-for="t in minuteTicks"
          :key="t.angle"
          x1="100" y1="13" :x2="100" :y2="t.major ? 19 : 16"
          :stroke="DIAL_INK" :stroke-width="t.major ? 1.3 : 0.6" :opacity="t.major ? 0.8 : 0.4"
          :transform="`rotate(${t.angle} 100 100)`"
        />
      </g>

      <!-- 立体时标 -->
      <g v-for="m in hourMarks" :key="m.angle" :transform="`rotate(${m.angle} 100 100)`">
        <rect
          v-if="m.square"
          x="96" y="23" width="8" height="11" rx="1.2"
          fill="url(#mark)" stroke="#8f5a41" stroke-width="0.5"
        />
        <circle v-else cx="100" cy="26.5" r="2.4" fill="url(#mark)" stroke="#8f5a41" stroke-width="0.4" />
      </g>

      <!-- 中央镂空窗（可见齿轮组，限制在 r≈27 内避免与子表盘重叠） -->
      <circle cx="100" cy="100" r="27" fill="url(#skeleton)" />
      <circle cx="100" cy="100" r="27" fill="none" :stroke="ROSE_GOLD" stroke-width="1.2" opacity="0.65" />
      <circle cx="100" cy="100" r="30.5" fill="none" :stroke="ROSE_GOLD_LIGHT" stroke-width="0.5" opacity="0.35" />
      <ChronoGears :now="now" :rose-gold="ROSE_GOLD" :brass="BRASS" />

      <!-- 左侧日期子表盘 -->
      <SubDial
        :cx="56" :cy="134" :r="24"
        :labels="dateLabels" :angle="dateAngle"
        :color="ROSE_GOLD_LIGHT" :hand-color="ROSE_GOLD" :font-family="theme.fontFamily"
      />
      <!-- 右侧星期子表盘 -->
      <SubDial
        :cx="144" :cy="134" :r="24"
        :labels="weekLabels" :angle="weekAngle"
        :color="ROSE_GOLD_LIGHT" :hand-color="ROSE_GOLD" :font-family="theme.fontFamily"
      />

      <!-- 镂空指针组（最上层） -->
      <ChronoHands :now="now" :seconds="seconds" :rose-gold="ROSE_GOLD" :second-color="ROSE_GOLD_LIGHT" />
    </svg>
  </div>
</template>

<style scoped>
.face-chrono {
  width: clamp(240px, 52vmin, 520px);
  height: clamp(240px, 52vmin, 520px);
  filter: drop-shadow(0 6px 24px rgba(0, 0, 0, 0.45));
}
svg { width: 100%; height: 100%; display: block; }
</style>
