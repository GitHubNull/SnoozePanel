<script setup lang="ts">
/**
 * 经典模拟表盘：简洁圆形表盘 + 12 刻度 + 时分秒针。
 * 迁移自原 ui/components/ClockAnalog.vue，接入统一表盘 props 与主题配色，秒针平滑。
 */
import { computed } from 'vue';
import { clockHands } from '@/core/clock';
import type { FaceProps } from '../types';

const props = defineProps<FaceProps>();

const hands = computed(() => clockHands(props.now));
const ticks = Array.from({ length: 12 }, (_, i) => i * 30);
</script>

<template>
  <div class="clock-analog">
    <svg viewBox="0 0 200 200" aria-hidden="true">
      <circle cx="100" cy="100" r="96" class="face" :style="{ borderColor: theme.textSecondary }" />
      <g class="ticks" :style="{ stroke: theme.textSecondary }">
        <line
          v-for="t in ticks"
          :key="t"
          x1="100" y1="8" x2="100" y2="18"
          :transform="`rotate(${t} 100 100)`"
        />
      </g>
      <line
        class="hand hour" :style="{ stroke: theme.text }"
        x1="100" y1="100" x2="100" y2="52"
        :transform="`rotate(${hands.hour} 100 100)`"
      />
      <line
        class="hand minute" :style="{ stroke: theme.text }"
        x1="100" y1="100" x2="100" y2="30"
        :transform="`rotate(${hands.minute} 100 100)`"
      />
      <line
        v-if="seconds"
        class="hand second" :style="{ stroke: theme.accent }"
        x1="100" y1="108" x2="100" y2="26"
        :transform="`rotate(${hands.second} 100 100)`"
      />
      <circle cx="100" cy="100" r="4" class="pin" :style="{ fill: theme.accent }" />
    </svg>
  </div>
</template>

<style scoped>
.clock-analog {
  width: clamp(160px, 32cqmin, 320px);
  height: clamp(160px, 32cqmin, 320px);
}
svg {
  width: 100%;
  height: 100%;
  display: block;
}
.face {
  fill: none;
  stroke-width: 2;
  stroke: currentColor;
  opacity: 0.4;
}
.ticks line {
  stroke-width: 2;
}
.hand {
  stroke-linecap: round;
}
.hand.hour { stroke-width: 5; }
.hand.minute { stroke-width: 3.5; }
.hand.second { stroke-width: 1.5; }
</style>
