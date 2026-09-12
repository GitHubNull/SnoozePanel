<script setup lang="ts">
/**
 * 数字环表盘：中央大号数字时间 + 外圈环形秒进度（智能手表风）。
 * 秒环随秒数连续填充，现代感强。
 */
import { computed } from 'vue';
import { formatClock } from '@/core/clock';
import type { FaceProps } from '../types';

const props = defineProps<FaceProps>();

const time = computed(() => formatClock(props.now, props.hour24, false));

// 环形秒进度：0-1
const progress = computed(() => {
  const s = props.now.getSeconds() + props.now.getMilliseconds() / 1000;
  return s / 60;
});

// 圆环参数（viewBox 200，半径 88，周长 ~553）
const R = 88;
const CIRC = 2 * Math.PI * R;
const dashOffset = computed(() => CIRC * (1 - progress.value));
</script>

<template>
  <div class="face-ring">
    <svg viewBox="0 0 200 200" aria-hidden="true">
      <!-- 底环 -->
      <circle cx="100" cy="100" :r="R" class="track" :style="{ stroke: theme.textSecondary }" />
      <!-- 秒进度环 -->
      <circle
        v-if="seconds"
        cx="100" cy="100" :r="R" class="progress"
        :style="{ stroke: theme.accent, strokeDasharray: `${CIRC}`, strokeDashoffset: `${dashOffset}` }"
        transform="rotate(-90 100 100)"
      />
    </svg>
    <div class="digits" :style="{ fontFamily: theme.fontFamily, color: theme.text }">
      <span class="time" :style="{ fontWeight: theme.clockWeight }">{{ time.main }}</span>
      <span v-if="time.period" class="period" :style="{ color: theme.textSecondary }">{{ time.period }}</span>
    </div>
  </div>
</template>

<style scoped>
.face-ring {
  position: relative;
  width: clamp(200px, 40vmin, 400px);
  height: clamp(200px, 40vmin, 400px);
}
svg { position: absolute; inset: 0; width: 100%; height: 100%; }
.track { fill: none; stroke-width: 3; opacity: 0.18; }
.progress {
  fill: none;
  stroke-width: 5;
  stroke-linecap: round;
  transition: stroke-dashoffset 0.2s linear;
}
.digits {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.4em;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}
.time { font-size: clamp(40px, 9vmin, 92px); letter-spacing: 0.02em; }
.period { font-size: clamp(16px, 3vmin, 30px); opacity: 0.7; align-self: flex-end; padding-bottom: 0.6em; }
</style>
