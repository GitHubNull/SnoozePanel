<script setup lang="ts">
import { computed } from 'vue';
import { formatClock } from '@/core/clock';

const props = defineProps<{
  now: Date;
  hour24: boolean;
  seconds: boolean;
}>();

const time = computed(() => formatClock(props.now, props.hour24, props.seconds));
</script>

<template>
  <div class="clock-digital">
    <span class="time">{{ time.main }}</span>
    <span v-if="time.period" class="period">{{ time.period }}</span>
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
  font-size: clamp(64px, 16vw, 220px);
  font-weight: inherit;
  letter-spacing: 0.02em;
}
.period {
  font-size: clamp(20px, 4vw, 48px);
  opacity: 0.7;
}
</style>
