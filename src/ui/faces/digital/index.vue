<script setup lang="ts">
/**
 * 数字时钟表盘：大号时分 + 可选秒与上/下午标识。
 * 迁移自原 ui/components/ClockDigital.vue，接入统一表盘 props。
 */
import { computed } from 'vue';
import { formatClock } from '@/core/clock';
import type { FaceProps } from '../types';

const props = defineProps<FaceProps>();

const time = computed(() => formatClock(props.now, props.hour24, props.seconds));
</script>

<template>
  <div class="clock-digital" :style="{ fontFamily: theme.fontFamily, fontWeight: theme.clockWeight, color: theme.text }">
    <span class="time">{{ time.main }}</span>
    <span v-if="time.period" class="period" :style="{ color: theme.textSecondary }">{{ time.period }}</span>
  </div>
</template>

<style scoped>
.clock-digital {
  display: flex;
  align-items: baseline;
  gap: 0.5em;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}
.time {
  font-size: clamp(64px, 16cqw, 220px);
  letter-spacing: 0.02em;
}
.period {
  font-size: clamp(20px, 4cqw, 48px);
  opacity: 0.7;
}
</style>
