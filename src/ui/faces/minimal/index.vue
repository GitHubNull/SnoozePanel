<script setup lang="ts">
/**
 * 极简正装表盘：细棒形指针 + 罗马数字时标 + 大留白，优雅克制。
 * 午夜/宣纸两主题均协调（取 theme 主色/次色/强调色）。
 */
import { computed } from 'vue';
import { clockHands } from '@/core/clock';
import type { FaceProps } from '../types';

const props = defineProps<FaceProps>();

const hands = computed(() => clockHands(props.now));

// 罗马数字时标（12/3/6/9 用罗马字，其余用细棒刻度）
const ROMAN: Record<number, string> = { 0: 'XII', 3: 'III', 6: 'VI', 9: 'IX' };
const marks = Array.from({ length: 12 }, (_, i) => ({
  angle: i * 30,
  label: ROMAN[i] ?? '',
  major: i % 3 === 0,
}));
</script>

<template>
  <div class="face-minimal">
    <svg viewBox="0 0 200 200" aria-hidden="true">
      <circle cx="100" cy="100" r="94" class="rim" :style="{ stroke: theme.textSecondary }" />
      <g v-for="m in marks" :key="m.angle" :transform="`rotate(${m.angle} 100 100)`">
        <text
          v-if="m.label"
          x="100" y="26" class="roman"
          :style="{ fill: theme.text, fontFamily: theme.fontFamily }"
          text-anchor="middle"
          :transform="`rotate(${-m.angle} 100 26)`"
        >{{ m.label }}</text>
        <line
          v-else
          x1="100" y1="14" x2="100" y2="22"
          class="tick" :style="{ stroke: theme.textSecondary }"
        />
      </g>
      <line
        class="hand hour" :style="{ stroke: theme.text }"
        x1="100" y1="104" x2="100" y2="58"
        :transform="`rotate(${hands.hour} 100 100)`"
      />
      <line
        class="hand minute" :style="{ stroke: theme.text }"
        x1="100" y1="106" x2="100" y2="34"
        :transform="`rotate(${hands.minute} 100 100)`"
      />
      <line
        v-if="seconds"
        class="hand second" :style="{ stroke: theme.accent }"
        x1="100" y1="110" x2="100" y2="28"
        :transform="`rotate(${hands.second} 100 100)`"
      />
      <circle cx="100" cy="100" r="3" :style="{ fill: theme.text }" />
    </svg>
  </div>
</template>

<style scoped>
.face-minimal {
  width: clamp(180px, 36vmin, 360px);
  height: clamp(180px, 36vmin, 360px);
}
svg { width: 100%; height: 100%; display: block; }
.rim { fill: none; stroke-width: 1; opacity: 0.35; }
.roman { font-size: 15px; font-weight: 300; letter-spacing: 0.05em; }
.tick { stroke-width: 1.5; opacity: 0.6; }
.hand { stroke-linecap: round; fill: none; }
.hand.hour { stroke-width: 3; }
.hand.minute { stroke-width: 2; }
.hand.second { stroke-width: 1; }
</style>
