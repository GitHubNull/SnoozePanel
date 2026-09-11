<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  now: Date;
  seconds: boolean;
}>();

const hands = computed(() => {
  const h = props.now.getHours() % 12;
  const m = props.now.getMinutes();
  const s = props.now.getSeconds();
  return {
    hour: (h + m / 60) * 30,          // 360/12
    minute: (m + s / 60) * 6,          // 360/60
    second: s * 6,
  };
});

const ticks = Array.from({ length: 12 }, (_, i) => i * 30);
</script>

<template>
  <div class="clock-analog">
    <svg viewBox="0 0 200 200" aria-hidden="true">
      <circle cx="100" cy="100" r="96" class="face" />
      <g class="ticks">
        <line
          v-for="t in ticks"
          :key="t"
          x1="100" y1="8" x2="100" y2="18"
          :transform="`rotate(${t} 100 100)`"
        />
      </g>
      <line
        class="hand hour"
        x1="100" y1="100" x2="100" y2="52"
        :transform="`rotate(${hands.hour} 100 100)`"
      />
      <line
        class="hand minute"
        x1="100" y1="100" x2="100" y2="30"
        :transform="`rotate(${hands.minute} 100 100)`"
      />
      <line
        v-if="seconds"
        class="hand second"
        x1="100" y1="108" x2="100" y2="26"
        :transform="`rotate(${hands.second} 100 100)`"
      />
      <circle cx="100" cy="100" r="4" class="pin" />
    </svg>
  </div>
</template>

<style scoped>
.clock-analog {
  width: clamp(180px, 32vw, 420px);
  aspect-ratio: 1;
}
svg { width: 100%; height: 100%; display: block; }
.face {
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  opacity: 0.4;
}
.ticks line {
  stroke: currentColor;
  stroke-width: 2;
  opacity: 0.5;
}
.hand {
  stroke: currentColor;
  stroke-linecap: round;
  transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
.hour { stroke-width: 6; }
.minute { stroke-width: 4; }
.second {
  stroke-width: 2;
  stroke: var(--snooze-accent, #5ea0ff);
  transition: none;
}
.pin { fill: currentColor; }
</style>
