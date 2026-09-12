<script setup lang="ts">
/**
 * 轨道同心圆表盘：多层同心圆环 + 外圈轨道刻度 + 双色调指针。
 * 介于极简与复杂之间，层次感强。
 */
import { computed } from 'vue';
import { clockHands } from '@/core/clock';
import type { FaceProps } from '../types';

const props = defineProps<FaceProps>();

const hands = computed(() => clockHands(props.now));

// 外圈 60 分钟轨道刻度（每 5 分钟加粗）
const orbitTicks = Array.from({ length: 60 }, (_, i) => ({
  angle: i * 6,
  major: i % 5 === 0,
}));
</script>

<template>
  <div class="face-orbit">
    <svg viewBox="0 0 200 200" aria-hidden="true">
      <!-- 同心圆环 -->
      <circle cx="100" cy="100" r="96" class="ring outer" :style="{ stroke: theme.textSecondary }" />
      <circle cx="100" cy="100" r="78" class="ring mid" :style="{ stroke: theme.textSecondary }" />
      <circle cx="100" cy="100" r="30" class="ring inner" :style="{ stroke: theme.accent }" />

      <!-- 外圈轨道刻度 -->
      <g>
        <line
          v-for="t in orbitTicks"
          :key="t.angle"
          x1="100" y1="6" :x2="100" :y2="t.major ? 14 : 10"
          :class="['otick', { major: t.major }]"
          :style="{ stroke: t.major ? theme.text : theme.textSecondary }"
          :transform="`rotate(${t.angle} 100 100)`"
        />
      </g>

      <!-- 双色调指针 -->
      <line
        class="hand hour" :style="{ stroke: theme.text }"
        x1="100" y1="102" x2="100" y2="56"
        :transform="`rotate(${hands.hour} 100 100)`"
      />
      <line
        class="hand minute" :style="{ stroke: theme.accent }"
        x1="100" y1="104" x2="100" y2="36"
        :transform="`rotate(${hands.minute} 100 100)`"
      />
      <line
        v-if="seconds"
        class="hand second" :style="{ stroke: theme.textSecondary }"
        x1="100" y1="108" x2="100" y2="24"
        :transform="`rotate(${hands.second} 100 100)`"
      />
      <circle cx="100" cy="100" r="5" class="hub" :style="{ fill: theme.accent }" />
      <circle cx="100" cy="100" r="2" :style="{ fill: theme.text }" />
    </svg>
  </div>
</template>

<style scoped>
.face-orbit {
  width: clamp(190px, 38vmin, 380px);
  height: clamp(190px, 38vmin, 380px);
}
svg { width: 100%; height: 100%; display: block; }
.ring { fill: none; }
.ring.outer { stroke-width: 1.5; opacity: 0.5; }
.ring.mid { stroke-width: 1; opacity: 0.3; }
.ring.inner { stroke-width: 1; opacity: 0.4; }
.otick { stroke-width: 1; opacity: 0.5; }
.otick.major { stroke-width: 2; opacity: 0.9; }
.hand { stroke-linecap: round; fill: none; }
.hand.hour { stroke-width: 5; }
.hand.minute { stroke-width: 3; }
.hand.second { stroke-width: 1.2; }
.hub { opacity: 0.9; }
</style>
