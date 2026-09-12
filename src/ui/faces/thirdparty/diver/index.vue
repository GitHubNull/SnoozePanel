<script setup lang="ts">
/**
 * 第三方潜水表表盘（技术示范）。
 *
 * 结构：钢壳 + 陶瓷单向旋转表圈（60 分钟刻度 + 12 点夜光珠）+ 深色表盘 +
 *       夜光时标（12 点三角 / 6·9 点长棒）+ 3 点位日期窗 + 剑形指针 + 棒棒糖秒针。
 *
 * 主题接入：仅依赖统一 FaceProps，按 theme.key 派生调色板（palette.ts），
 *           午夜=冷钢高亮夜光、宣纸=暖钢收敛夜光，两主题均自适应。
 * 组件拆分：DiverBezel（表圈）/ DiverHands（指针）/ palette（配色）。
 */
import { computed, useId } from 'vue';
import type { FaceProps } from '../../types';
import { diverPalette } from './palette';
import DiverBezel from './DiverBezel.vue';
import DiverHands from './DiverHands.vue';

const props = defineProps<FaceProps>();

// 实例化唯一 id 前缀，避免多实例 defs id 冲突
const uid = useId();
const id = (n: string) => `${n}-${uid}`;

const palette = computed(() => diverPalette(props.theme.key));

// 日期窗内容（3 点位）
const dayText = computed(() => String(props.now.getDate()));

// 时标：12 个位置；3 点为日期窗，12 点为三角，6/9 点为长棒，其余为短棒
const markers = Array.from({ length: 12 }, (_, i) => {
  const angle = i * 30;
  if (i === 0) return { angle, shape: 'triangle' as const };
  if (i === 3) return { angle, shape: 'none' as const };
  if (i === 6 || i === 9) return { angle, shape: 'long' as const };
  return { angle, shape: 'baton' as const };
});

// 内圈分钟轨道（60 刻度）
const minuteTicks = Array.from({ length: 60 }, (_, i) => ({ angle: i * 6, major: i % 5 === 0 }));
</script>

<template>
  <div class="face-diver" :style="{ filter: `drop-shadow(0 6px 24px ${palette.shadow})` }">
    <svg viewBox="0 0 200 200" aria-hidden="true">
      <defs>
        <!-- 表盘径向渐变（中心略亮） -->
        <radialGradient :id="id('dial')" cx="0.5" cy="0.4" r="0.8">
          <stop offset="0%" stop-color="#1a2028" />
          <stop offset="62%" :stop-color="palette.dial" />
          <stop offset="100%" :stop-color="palette.dialEdge" />
        </radialGradient>
        <!-- 表盘暗角 -->
        <radialGradient :id="id('vig')" cx="0.5" cy="0.5" r="0.5">
          <stop offset="70%" stop-color="#000000" stop-opacity="0" />
          <stop offset="100%" stop-color="#000000" stop-opacity="0.22" />
        </radialGradient>
      </defs>

      <!-- 钢壳 + 陶瓷表圈 -->
      <DiverBezel :palette="palette" :font-family="theme.fontFamily" />

      <!-- 表盘 -->
      <circle cx="100" cy="100" r="72" :fill="`url(#${id('dial')})`" />
      <circle cx="100" cy="100" r="72" :fill="`url(#${id('vig')})`" />

      <!-- 内圈分钟轨道 -->
      <line
        v-for="t in minuteTicks"
        :key="t.angle"
        x1="100" y1="31" :x2="100" :y2="t.major ? 36 : 34"
        :stroke="palette.markerInk" :stroke-width="t.major ? 0.8 : 0.4" :opacity="t.major ? 0.7 : 0.4"
        :transform="`rotate(${t.angle} 100 100)`"
      />

      <!-- 夜光时标 -->
      <g v-for="m in markers" :key="m.angle" :transform="`rotate(${m.angle} 100 100)`">
        <polygon v-if="m.shape === 'triangle'" points="100,37 95.4,48.5 104.6,48.5" :fill="palette.lume" />
        <rect
          v-else-if="m.shape === 'long'"
          x="98" y="35" width="4" height="15" rx="1.4"
          :fill="palette.lume"
        />
        <rect
          v-else-if="m.shape === 'baton'"
          x="98.2" y="37" width="3.6" height="11" rx="1.2"
          :fill="palette.lume"
        />
      </g>

      <!-- 表盘文字 -->
      <text x="100" y="61" class="diver-text" :fill="palette.textDim" :font-family="theme.fontFamily" text-anchor="middle">200m / 660ft</text>
      <text x="100" y="134" class="diver-brand" :fill="palette.text" :font-family="theme.fontFamily" text-anchor="middle" letter-spacing="0.12em">SNOOZE</text>
      <text x="100" y="142" class="diver-text" :fill="palette.textDim" :font-family="theme.fontFamily" text-anchor="middle" letter-spacing="0.08em">AUTOMATIC</text>

      <!-- 3 点位日期窗 -->
      <rect x="129" y="91.5" width="22" height="17" rx="2" fill="#f2f4f6" :stroke="palette.steelDark" stroke-width="0.7" />
      <text x="140" y="100.5" class="diver-date" fill="#14171b" text-anchor="middle" dominant-baseline="central">{{ dayText }}</text>

      <!-- 指针 -->
      <DiverHands :now="now" :seconds="seconds" :palette="palette" />
    </svg>
  </div>
</template>

<style scoped>
.face-diver {
  width: clamp(240px, 52vmin, 520px);
  height: clamp(240px, 52vmin, 520px);
}
svg { width: 100%; height: 100%; display: block; }
.diver-text { font-size: 5.4px; font-weight: 500; letter-spacing: 0.04em; }
.diver-brand { font-size: 7.5px; font-weight: 700; }
.diver-date { font-size: 9px; font-weight: 700; }
</style>
