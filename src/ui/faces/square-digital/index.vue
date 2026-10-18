<script setup lang="ts">
/**
 * 方形数字表盘：方形电子时钟（品质标杆级）。
 *
 * 结构：多层玻璃面板（外框金属 + 玻璃反光 + 内凹屏幕）+
 *       大数字时间（发光效果）+ 日期/星期信息条 +
 *       底部秒进度条（带发光端点）。
 *
 * 主题：midnight 用深色玻璃 + 蓝光数字；paper 用浅色玻璃 + 深色数字。
 */
import { computed, useId } from 'vue';
import { formatClock, formatDate } from '@/core/clock';
import type { FaceProps } from '../types';

const props = defineProps<FaceProps>();

const uid = useId();
const id = (name: string) => `${name}-${uid}`;

const time = computed(() => formatClock(props.now, props.hour24, props.seconds));
const dateStr = computed(() => formatDate(props.now, 'YYYY年M月D日'));
const weekStr = computed(() => formatDate(props.now, 'dddd'));

/** 秒进度 0-1 */
const secProgress = computed(() => {
  const s = props.now.getSeconds() + props.now.getMilliseconds() / 1000;
  return s / 60;
});

/** 主题化调色板 */
const palette = computed(() =>
  props.theme.key === 'paper'
    ? {
        frameLight: '#d4c9a8',
        frameMid: '#b8a878',
        frameDark: '#8a7a50',
        frameEdge: '#6a5c3a',
        glassTop: '#fdfcf8',
        glassMid: '#f5f0e6',
        glassEdge: '#e8e0d0',
        screenTop: '#f8f5ee',
        screenMid: '#f0ebe0',
        screenEdge: '#e0d8c8',
        digit: '#2b2620',
        digitDim: 'rgba(43, 38, 32, 0.5)',
        accent: '#b3543a',
        accentLight: '#d4756a',
        infoBg: 'rgba(43, 38, 32, 0.05)',
        border: '#c9bfa8',
        shadow: 'rgba(60, 45, 30, 0.35)',
      }
    : {
        frameLight: '#3a4560',
        frameMid: '#2a3550',
        frameDark: '#1a2440',
        frameEdge: '#0e1428',
        glassTop: '#1e2a45',
        glassMid: '#162038',
        glassEdge: '#0e1628',
        screenTop: '#141c30',
        screenMid: '#0e1424',
        screenEdge: '#080c18',
        digit: '#5ea0ff',
        digitDim: 'rgba(94, 160, 255, 0.45)',
        accent: '#8ec5ff',
        accentLight: '#b8daff',
        infoBg: 'rgba(94, 160, 255, 0.06)',
        border: '#2a3550',
        shadow: 'rgba(0, 0, 0, 0.55)',
      },
);

// 底部秒进度条
const BAR_W = 80;
const barX = 60;
const barFill = computed(() => BAR_W * secProgress.value);
</script>

<template>
  <div class="face-square-digital" :style="{ filter: `drop-shadow(0 12px 36px ${palette.shadow})` }">
    <svg viewBox="0 0 200 200" aria-hidden="true">
      <defs>
        <!-- 外框金属渐变 -->
        <linearGradient :id="id('frame')" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" :stop-color="palette.frameLight" />
          <stop offset="30%" :stop-color="palette.frameMid" />
          <stop offset="55%" :stop-color="palette.frameDark" />
          <stop offset="80%" :stop-color="palette.frameMid" />
          <stop offset="100%" :stop-color="palette.frameDark" />
        </linearGradient>
        <!-- 外框内侧暗部 -->
        <linearGradient :id="id('frameInner')" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" :stop-color="palette.frameEdge" stop-opacity="0.5" />
          <stop offset="25%" :stop-color="palette.frameEdge" stop-opacity="0.05" />
          <stop offset="75%" :stop-color="palette.frameEdge" stop-opacity="0.05" />
          <stop offset="100%" :stop-color="palette.frameEdge" stop-opacity="0.4" />
        </linearGradient>
        <!-- 玻璃面板渐变 -->
        <linearGradient :id="id('glass')" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" :stop-color="palette.glassTop" />
          <stop offset="50%" :stop-color="palette.glassMid" />
          <stop offset="100%" :stop-color="palette.glassEdge" />
        </linearGradient>
        <!-- 玻璃反光（斜向高光） -->
        <linearGradient :id="id('glassGloss')" x1="0.1" y1="0" x2="0.8" y2="1">
          <stop offset="0%" stop-color="#ffffff" stop-opacity="0.14" />
          <stop offset="35%" stop-color="#ffffff" stop-opacity="0.03" />
          <stop offset="60%" stop-color="#ffffff" stop-opacity="0" />
        </linearGradient>
        <!-- 屏幕内凹渐变 -->
        <radialGradient :id="id('screen')" cx="0.5" cy="0.45" r="0.75">
          <stop offset="0%" :stop-color="palette.screenTop" />
          <stop offset="70%" :stop-color="palette.screenMid" />
          <stop offset="100%" :stop-color="palette.screenEdge" />
        </radialGradient>
        <!-- 屏幕边缘暗角 -->
        <radialGradient :id="id('screenVignette')" cx="0.5" cy="0.5" r="0.5">
          <stop offset="70%" stop-color="#000000" stop-opacity="0" />
          <stop offset="100%" stop-color="#000000" stop-opacity="0.12" />
        </radialGradient>
        <!-- 数字发光渐变 -->
        <linearGradient :id="id('digit')" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" :stop-color="palette.digit" />
          <stop offset="100%" :stop-color="palette.digit" stop-opacity="0.88" />
        </linearGradient>
        <!-- 数字发光滤镜 -->
        <filter :id="id('glow')" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <!-- 强调色渐变 -->
        <linearGradient :id="id('accent')" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" :stop-color="palette.accentLight" />
          <stop offset="100%" :stop-color="palette.accent" />
        </linearGradient>
      </defs>

      <!-- ═══ 外框（3 层叠加） ═══ -->
      <rect x="4" y="4" width="192" height="192" rx="24" :fill="`url(#${id('frame')})`" />
      <rect x="4" y="4" width="192" height="192" rx="24" :fill="`url(#${id('frameInner')})`" />
      <rect x="4" y="4" width="192" height="192" rx="24" fill="none" :stroke="palette.frameLight" stroke-width="0.8" opacity="0.4" />
      <rect x="8" y="8" width="184" height="184" rx="20" fill="none" :stroke="palette.frameEdge" stroke-width="1" opacity="0.6" />

      <!-- ═══ 玻璃面板 ═══ -->
      <rect x="12" y="12" width="176" height="176" rx="18" :fill="`url(#${id('glass')})`" />
      <rect x="12" y="12" width="176" height="176" rx="18" :fill="`url(#${id('glassGloss')})`" />
      <rect x="12" y="12" width="176" height="176" rx="18" fill="none" :stroke="palette.border" stroke-width="0.6" opacity="0.5" />

      <!-- ═══ 内凹屏幕 ═══ -->
      <rect x="20" y="20" width="160" height="160" rx="14" :fill="`url(#${id('screen')})`" />
      <rect x="20" y="20" width="160" height="160" rx="14" :fill="`url(#${id('screenVignette')})`" />
      <!-- 屏幕内沿阴影线 -->
      <rect x="20" y="20" width="160" height="160" rx="14" fill="none" :stroke="palette.frameEdge" stroke-width="1" opacity="0.3" />
      <rect x="22" y="22" width="156" height="156" rx="12" fill="none" :stroke="palette.frameLight" stroke-width="0.3" opacity="0.15" />

      <!-- ═══ 时间数字（带发光，缩小字号避免贴边） ═══ -->
      <text
        x="100" y="88"
        text-anchor="middle"
        :fill="`url(#${id('digit')})`"
        :font-family="theme.fontFamily"
        font-weight="200"
        font-size="36"
        letter-spacing="1.5"
        :filter="`url(#${id('glow')})`"
      >{{ time.main }}</text>

      <!-- 上/下午标识 -->
      <text
        v-if="time.period"
        x="100" y="108"
        text-anchor="middle"
        :fill="palette.digitDim"
        :font-family="theme.fontFamily"
        font-size="12"
        letter-spacing="3"
      >{{ time.period }}</text>

      <!-- ═══ 分隔线 ═══ -->
      <line x1="40" y1="122" x2="160" y2="122" :stroke="palette.border" stroke-width="0.6" opacity="0.4" />
      <line x1="65" y1="122" x2="135" y2="122" :stroke="palette.accent" stroke-width="0.8" opacity="0.3" />

      <!-- ═══ 信息区：日期 + 星期 ═══ -->
      <rect x="40" y="134" width="120" height="28" rx="7" :fill="palette.infoBg" />
      <rect x="40" y="134" width="120" height="28" rx="7" fill="none" :stroke="palette.border" stroke-width="0.4" opacity="0.3" />
      <text
        x="100" y="152"
        text-anchor="middle"
        :fill="palette.digitDim"
        :font-family="theme.fontFamily"
        font-size="10"
        letter-spacing="0.5"
      >{{ dateStr }} · {{ weekStr }}</text>

      <!-- ═══ 底部秒进度条（水平，带发光端点） ═══ -->
      <rect :x="barX" y="176" :width="BAR_W" height="2.5" rx="1.25" :fill="palette.infoBg" />
      <rect
        :x="barX" y="176" :width="barFill" height="2.5" rx="1.25"
        :fill="`url(#${id('accent')})`"
      />
      <!-- 进度条右端发光点 -->
      <circle
        v-if="seconds"
        :cx="barX + barFill" cy="177.25" r="2"
        :fill="palette.accentLight" opacity="0.8"
      />
    </svg>
  </div>
</template>

<style scoped>
.face-square-digital {
  width: clamp(220px, 48cqmin, 480px);
  height: clamp(220px, 48cqmin, 480px);
}
svg { width: 100%; height: 100%; display: block; }
</style>
