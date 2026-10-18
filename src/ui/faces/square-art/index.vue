<script setup lang="ts">
/**
 * 方形艺术表盘：现代几何风格（品质标杆级）。
 *
 * 结构：多层方形画布（外框 + 渐变底 + 内凹）+
 *       中央大数字时间（发光效果）+
 *       外圈环形秒进度（带发光端点，缩小避免与文字重叠）+
 *       四角装饰线条（双层）+
 *       外圈装饰刻度环 + 底部日期/星期信息。
 *
 * 主题：midnight 用深色底 + 蓝光强调；paper 用浅色底 + 赭石强调。
 */
import { computed, useId } from 'vue';
import { formatClock, formatDate } from '@/core/clock';
import type { FaceProps } from '../types';

const props = defineProps<FaceProps>();

const uid = useId();
const id = (name: string) => `${name}-${uid}`;

const time = computed(() => formatClock(props.now, props.hour24, false));
const dateStr = computed(() => formatDate(props.now, 'M月D日'));
const weekStr = computed(() => formatDate(props.now, 'ddd'));

/** 秒进度 0-1 */
const progress = computed(() => {
  const s = props.now.getSeconds() + props.now.getMilliseconds() / 1000;
  return s / 60;
});

/** 主题化调色板 */
const palette = computed(() =>
  props.theme.key === 'paper'
    ? {
        frame: '#d4c9a8',
        frameEdge: '#b0a078',
        bgTop: '#fdfcf8',
        bgMid: '#f5f0e6',
        bgEdge: '#e8e0d0',
        digit: '#2b2620',
        digitDim: 'rgba(43, 38, 32, 0.45)',
        accent: '#b3543a',
        accentLight: '#d4756a',
        deco: 'rgba(43, 38, 32, 0.12)',
        decoStrong: 'rgba(43, 38, 32, 0.22)',
        shadow: 'rgba(60, 45, 30, 0.3)',
      }
    : {
        frame: '#2a3550',
        frameEdge: '#1a2440',
        bgTop: '#1a2035',
        bgMid: '#12172a',
        bgEdge: '#0a0e1a',
        digit: '#eef2f8',
        digitDim: 'rgba(238, 242, 248, 0.42)',
        accent: '#5ea0ff',
        accentLight: '#8ec5ff',
        deco: 'rgba(238, 242, 248, 0.1)',
        decoStrong: 'rgba(238, 242, 248, 0.2)',
        shadow: 'rgba(0, 0, 0, 0.55)',
      },
);

// 环形秒进度（缩小到 R=58，避免与日期文字重叠）
const R = 52;
const CIRC = 2 * Math.PI * R;
const dashOffset = computed(() => CIRC * (1 - progress.value));

// 四角装饰线（双层）
const corners = [
  { x: 16, y: 16, dx: 1, dy: 1 },
  { x: 184, y: 16, dx: -1, dy: 1 },
  { x: 16, y: 184, dx: 1, dy: -1 },
  { x: 184, y: 184, dx: -1, dy: -1 },
];

// 外圈装饰刻度（36 个，每 10 度一个，每 30 度加粗）
const decoTicks = Array.from({ length: 36 }, (_, i) => ({
  angle: i * 10,
  major: i % 3 === 0,
}));
</script>

<template>
  <div class="face-square-art" :style="{ filter: `drop-shadow(0 12px 36px ${palette.shadow})` }">
    <svg viewBox="0 0 200 200" aria-hidden="true">
      <defs>
        <!-- 外框渐变 -->
        <linearGradient :id="id('frame')" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" :stop-color="palette.frame" />
          <stop offset="50%" :stop-color="palette.frameEdge" />
          <stop offset="100%" :stop-color="palette.frame" />
        </linearGradient>
        <!-- 背景径向渐变 -->
        <radialGradient :id="id('bg')" cx="0.5" cy="0.45" r="0.75">
          <stop offset="0%" :stop-color="palette.bgTop" />
          <stop offset="60%" :stop-color="palette.bgMid" />
          <stop offset="100%" :stop-color="palette.bgEdge" />
        </radialGradient>
        <!-- 背景暗角 -->
        <radialGradient :id="id('vignette')" cx="0.5" cy="0.5" r="0.5">
          <stop offset="70%" stop-color="#000000" stop-opacity="0" />
          <stop offset="100%" stop-color="#000000" stop-opacity="0.1" />
        </radialGradient>
        <!-- 数字渐变 -->
        <linearGradient :id="id('digit')" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" :stop-color="palette.digit" />
          <stop offset="100%" :stop-color="palette.digit" stop-opacity="0.88" />
        </linearGradient>
        <!-- 数字发光滤镜 -->
        <filter :id="id('glow')" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <!-- 强调色渐变 -->
        <linearGradient :id="id('accent')" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" :stop-color="palette.accentLight" />
          <stop offset="100%" :stop-color="palette.accent" />
        </linearGradient>
      </defs>

      <!-- ═══ 外框 ═══ -->
      <rect x="4" y="4" width="192" height="192" rx="20" :fill="`url(#${id('frame')})`" />
      <rect x="4" y="4" width="192" height="192" rx="20" fill="none" :stroke="palette.frame" stroke-width="0.6" opacity="0.5" />
      <rect x="8" y="8" width="184" height="184" rx="16" fill="none" :stroke="palette.frameEdge" stroke-width="0.8" opacity="0.6" />

      <!-- ═══ 背景 ═══ -->
      <rect x="12" y="12" width="176" height="176" rx="14" :fill="`url(#${id('bg')})`" />
      <rect x="12" y="12" width="176" height="176" rx="14" :fill="`url(#${id('vignette')})`" />
      <rect x="12" y="12" width="176" height="176" rx="14" fill="none" :stroke="palette.frameEdge" stroke-width="0.6" opacity="0.3" />
      <rect x="14" y="14" width="172" height="172" rx="12" fill="none" :stroke="palette.frame" stroke-width="0.3" opacity="0.15" />

      <!-- ═══ 四角装饰线（双层） ═══ -->
      <g :stroke="palette.deco" stroke-width="1" stroke-linecap="round">
        <line v-for="(c, i) in corners" :key="`o${i}`" :x1="c.x" :y1="c.y" :x2="c.x + c.dx * 14" :y2="c.y" />
        <line v-for="(c, i) in corners" :key="`ov${i}`" :x1="c.x" :y1="c.y" :x2="c.x" :y2="c.y + c.dy * 14" />
      </g>
      <g :stroke="palette.decoStrong" stroke-width="1.5" stroke-linecap="round">
        <line v-for="(c, i) in corners" :key="`i${i}`" :x1="c.x + c.dx * 3" :y1="c.y + c.dy * 3" :x2="c.x + c.dx * 10" :y2="c.y + c.dy * 3" />
        <line v-for="(c, i) in corners" :key="`iv${i}`" :x1="c.x + c.dx * 3" :y1="c.y + c.dy * 3" :x2="c.x + c.dx * 3" :y2="c.y + c.dy * 10" />
      </g>

      <!-- ═══ 外圈装饰刻度 ═══ -->
      <g>
        <line
          v-for="t in decoTicks"
          :key="t.angle"
          x1="100" y1="20" :x2="100" :y2="t.major ? 26 : 23"
          :stroke="palette.deco" :stroke-width="t.major ? 1 : 0.5"
          :transform="`rotate(${t.angle} 100 100)`"
        />
      </g>

      <!-- ═══ 环形秒进度（缩小到 R=58，避免与文字重叠） ═══ -->
      <circle cx="100" cy="100" :r="R" fill="none" :stroke="palette.deco" stroke-width="1.5" />
      <circle
        v-if="seconds"
        cx="100" cy="100" :r="R" fill="none"
        :stroke="`url(#${id('accent')})`" stroke-width="2.5" stroke-linecap="round"
        :stroke-dasharray="CIRC" :stroke-dashoffset="dashOffset"
        transform="rotate(-90 100 100)"
      />
      <!-- 进度端点发光 -->
      <circle
        v-if="seconds"
        :cx="100 + R * Math.cos((progress * 360 - 90) * Math.PI / 180)"
        :cy="100 + R * Math.sin((progress * 360 - 90) * Math.PI / 180)"
        r="2.5"
        :fill="palette.accentLight"
        opacity="0.9"
      />

      <!-- ═══ 中央大数字（带发光，缩小字号） ═══ -->
      <text
        x="100" y="104"
        text-anchor="middle"
        :fill="`url(#${id('digit')})`"
        :font-family="theme.fontFamily"
        :font-weight="theme.clockWeight"
        font-size="42"
        letter-spacing="1"
        :filter="`url(#${id('glow')})`"
      >{{ time.main }}</text>

      <!-- 上/下午标识 -->
      <text
        v-if="time.period"
        x="100" y="122"
        text-anchor="middle"
        :fill="palette.digitDim"
        :font-family="theme.fontFamily"
        font-size="11"
        letter-spacing="3"
      >{{ time.period }}</text>

      <!-- ═══ 底部信息（移到环形外） ═══ -->
      <text
        x="100" y="168"
        text-anchor="middle"
        :fill="palette.digitDim"
        :font-family="theme.fontFamily"
        font-size="11"
        letter-spacing="2"
      >{{ dateStr }} · 周{{ weekStr }}</text>

      <!-- ═══ 底部装饰点 ═══ -->
      <circle cx="88" cy="182" r="1.5" :fill="palette.accent" opacity="0.35" />
      <circle cx="100" cy="182" r="1.8" :fill="palette.accent" opacity="0.55" />
      <circle cx="112" cy="182" r="1.5" :fill="palette.accent" opacity="0.35" />
    </svg>
  </div>
</template>

<style scoped>
.face-square-art {
  width: clamp(220px, 48cqmin, 480px);
  height: clamp(220px, 48cqmin, 480px);
}
svg { width: 100%; height: 100%; display: block; }
</style>
