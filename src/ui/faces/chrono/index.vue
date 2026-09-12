<script setup lang="ts">
/**
 * 机械计时码表表盘（品质标杆）。
 *
 * 结构：拉丝金属表圈 + 奶白表盘 + 立体时标 + 外圈分钟刻度 +
 *       中央镂空窗（可见齿轮组）+ 左日期子表盘（1-31）+ 右星期子表盘（日~六，中文编号）+
 *       镂空剑形时分针 + 纤细秒针。
 *
 * 主题：按 theme.key 切换金属调色板——midnight 用暖玫瑰金 + 奶白表盘；
 *       paper 用古铜深金 + 高对比奶白表盘 + 更浅落影，两主题均为高水准呈现。
 * 子组件：ChronoGears（齿轮组）/ SubDial（子表盘）/ ChronoHands（镂空指针组）。
 */
import { computed, useId } from 'vue';
import { dateSubDialAngle, weekdaySubDialAngle } from '@/core/clock';
import type { FaceProps } from '../types';
import ChronoGears from './ChronoGears.vue';
import SubDial from './SubDial.vue';
import ChronoHands from './ChronoHands.vue';

const props = defineProps<FaceProps>();

// 实例化唯一 id 前缀：避免市场 / 预览多实例同时渲染时 defs id 冲突
const uid = useId();
const id = (name: string) => `${name}-${uid}`;

/** 主题化金属调色板 */
const palette = computed(() =>
  props.theme.key === 'paper'
    ? {
        bezelLight: '#e9cf96',
        bezelMid: '#c69a54',
        bezelDark: '#8a6432',
        bezelEdge: '#7a5628',
        mark: '#b98a4e',
        dialTop: '#fbf7ee',
        dialMid: '#f1e9d8',
        dialEdge: '#dccdb0',
        ink: '#3f3428',
        skeletonInner: '#2a1c14',
        skeletonOuter: '#150e0a',
        shadow: 'rgba(60, 45, 30, 0.35)',
        gearGold: '#c69a54',
        gearBrass: '#b58a3c',
      }
    : {
        bezelLight: '#e8c9a0',
        bezelMid: '#c8876a',
        bezelDark: '#8f5a41',
        bezelEdge: '#7a4a33',
        mark: '#e8c9a0',
        dialTop: '#faf6ec',
        dialMid: '#f3ede2',
        dialEdge: '#e4dbc8',
        ink: '#4a3f33',
        skeletonInner: '#241813',
        skeletonOuter: '#1a120c',
        shadow: 'rgba(0, 0, 0, 0.45)',
        gearGold: '#c8876a',
        gearBrass: '#d4af37',
      },
);

// 日期子表盘：31 天；仅 1/5/10…30 显示数字，其余为刻度线（避免外圈文字拥挤）
const dateLabels = Array.from({ length: 31 }, (_, i) => {
  const day = i + 1;
  return day === 1 || day % 5 === 0 ? String(day) : '';
});
// 星期子表盘：日..六（中文星期编号，索引对齐 Date.getDay()：0=周日）
const weekLabels = ['日', '一', '二', '三', '四', '五', '六'];

const dateAngle = computed(() => dateSubDialAngle(props.now));
const weekAngle = computed(() => weekdaySubDialAngle(props.now));

// 立体时标：12 个，棒形（3/6/9/12 双方棒）+ 圆点交替，带轻微高光
const hourMarks = Array.from({ length: 12 }, (_, i) => ({
  angle: i * 30,
  square: i % 3 === 0, // 3/6/9/12 用方块立体时标
}));

// 外圈分钟刻度（60 个）
const minuteTicks = Array.from({ length: 60 }, (_, i) => ({ angle: i * 6, major: i % 5 === 0 }));

// 表盘同心环形装饰纹理（日内瓦纹意象，极低对比）
const dialRings = Array.from({ length: 13 }, (_, i) => 24 + i * 5);
</script>

<template>
  <div class="face-chrono" :style="{ filter: `drop-shadow(0 6px 24px ${palette.shadow})` }">
    <svg viewBox="0 0 200 200" aria-hidden="true">
      <defs>
        <!-- 表圈金属拉丝渐变（多段 stop 模拟拉丝反光） -->
        <linearGradient :id="id('bezel')" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" :stop-color="palette.bezelLight" />
          <stop offset="28%" :stop-color="palette.bezelMid" />
          <stop offset="52%" :stop-color="palette.bezelDark" />
          <stop offset="74%" :stop-color="palette.bezelMid" />
          <stop offset="100%" :stop-color="palette.bezelDark" />
        </linearGradient>
        <!-- 镜面高光（左上）叠加，营造金属光泽 -->
        <linearGradient :id="id('gloss')" x1="0.1" y1="0" x2="0.75" y2="1">
          <stop offset="0%" stop-color="#ffffff" stop-opacity="0.42" />
          <stop offset="45%" stop-color="#ffffff" stop-opacity="0.06" />
          <stop offset="100%" stop-color="#ffffff" stop-opacity="0" />
        </linearGradient>
        <!-- 表盘奶白径向渐变（中心略亮） -->
        <radialGradient :id="id('dial')" cx="0.5" cy="0.42" r="0.78">
          <stop offset="0%" :stop-color="palette.dialTop" />
          <stop offset="68%" :stop-color="palette.dialMid" />
          <stop offset="100%" :stop-color="palette.dialEdge" />
        </radialGradient>
        <!-- 表盘边缘暗角 -->
        <radialGradient :id="id('vignette')" cx="0.5" cy="0.5" r="0.5">
          <stop offset="72%" stop-color="#000000" stop-opacity="0" />
          <stop offset="100%" stop-color="#000000" stop-opacity="0.16" />
        </radialGradient>
        <!-- 立体时标高光 -->
        <linearGradient :id="id('mark')" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" :stop-color="palette.bezelLight" />
          <stop offset="100%" :stop-color="palette.bezelMid" />
        </linearGradient>
        <!-- 中央镂空窗暗场（中心略亮，露出齿轮） -->
        <radialGradient :id="id('skeleton')" cx="0.5" cy="0.45" r="0.62">
          <stop offset="0%" :stop-color="palette.skeletonInner" />
          <stop offset="100%" :stop-color="palette.skeletonOuter" />
        </radialGradient>
      </defs>

      <!-- 拉丝表圈 + 镜面高光 + 倒角描边 -->
      <circle cx="100" cy="100" r="98" :fill="`url(#${id('bezel')})`" />
      <circle cx="100" cy="100" r="98" :fill="`url(#${id('gloss')})`" />
      <circle cx="100" cy="100" r="98" fill="none" :stroke="palette.bezelLight" stroke-width="0.8" opacity="0.5" />
      <circle cx="100" cy="100" r="90" fill="none" :stroke="palette.bezelEdge" stroke-width="0.9" opacity="0.65" />

      <!-- 奶白表盘 + 日内瓦环形纹理 + 边缘暗角 -->
      <circle cx="100" cy="100" r="88" :fill="`url(#${id('dial')})`" />
      <g fill="none" :stroke="palette.ink" stroke-width="0.4" opacity="0.05">
        <circle v-for="r in dialRings" :key="r" cx="100" cy="100" :r="r" />
      </g>
      <circle cx="100" cy="100" r="88" :fill="`url(#${id('vignette')})`" />

      <!-- 外圈分钟刻度环 -->
      <g>
        <line
          v-for="t in minuteTicks"
          :key="t.angle"
          x1="100" y1="13" :x2="100" :y2="t.major ? 19 : 16"
          :stroke="palette.ink" :stroke-width="t.major ? 1.3 : 0.6" :opacity="t.major ? 0.8 : 0.4"
          :transform="`rotate(${t.angle} 100 100)`"
        />
      </g>

      <!-- 立体时标 -->
      <g v-for="m in hourMarks" :key="m.angle" :transform="`rotate(${m.angle} 100 100)`">
        <rect
          v-if="m.square"
          x="96" y="23" width="8" height="11" rx="1.2"
          :fill="`url(#${id('mark')})`" :stroke="palette.bezelEdge" stroke-width="0.5"
        />
        <circle v-else cx="100" cy="26.5" r="2.4" :fill="`url(#${id('mark')})`" :stroke="palette.bezelEdge" stroke-width="0.4" />
      </g>

      <!-- 中央镂空窗（可见齿轮组，限制在 r≈27 内避免与子表盘重叠） -->
      <circle cx="100" cy="100" r="27" :fill="`url(#${id('skeleton')})`" />
      <circle cx="100" cy="100" r="27" fill="none" :stroke="palette.gearGold" stroke-width="1.2" opacity="0.65" />
      <circle cx="100" cy="100" r="30.5" fill="none" :stroke="palette.bezelLight" stroke-width="0.5" opacity="0.35" />
      <ChronoGears :now="now" :rose-gold="palette.gearGold" :brass="palette.gearBrass" />

      <!-- 左侧日期子表盘 -->
      <SubDial
        :cx="56" :cy="134" :r="24"
        :labels="dateLabels" :angle="dateAngle"
        :color="palette.bezelLight" :hand-color="palette.gearGold" :font-family="theme.fontFamily"
      />
      <!-- 右侧星期子表盘 -->
      <SubDial
        :cx="144" :cy="134" :r="24"
        :labels="weekLabels" :angle="weekAngle"
        :color="palette.bezelLight" :hand-color="palette.gearGold" :font-family="theme.fontFamily"
      />

      <!-- 镂空指针组（最上层） -->
      <ChronoHands :now="now" :seconds="seconds" :rose-gold="palette.gearGold" :second-color="palette.bezelLight" />
    </svg>
  </div>
</template>

<style scoped>
.face-chrono {
  width: clamp(240px, 52cqmin, 520px);
  height: clamp(240px, 52cqmin, 520px);
}
svg { width: 100%; height: 100%; display: block; }
</style>
