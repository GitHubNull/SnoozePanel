<script setup lang="ts">
import { computed } from 'vue';
import type { HassLike } from '@/core/hass';

const props = defineProps<{
  hass: HassLike;
  entity: string;
}>();

const CONDITION_CN: Record<string, string> = {
  'clear-night': '晴夜',
  cloudy: '阴',
  exceptional: '异常',
  fog: '雾',
  hail: '冰雹',
  lightning: '雷电',
  'lightning-rainy': '雷阵雨',
  partlycloudy: '多云',
  pouring: '暴雨',
  rainy: '雨',
  snowy: '雪',
  'snowy-rainy': '雨夹雪',
  sunny: '晴',
  windy: '大风',
  'windy-variant': '大风',
};

const info = computed(() => {
  const s = props.hass.states[props.entity];
  if (!s) return null;
  const temp = s.attributes.temperature;
  const cond = CONDITION_CN[s.state] ?? s.state;
  const humidity = s.attributes.humidity;
  return {
    condition: cond,
    temperature: typeof temp === 'number' ? `${Math.round(temp)}°` : '',
    humidity: typeof humidity === 'number' ? `${Math.round(humidity)}%` : '',
  };
});
</script>

<template>
  <div v-if="info" class="weather">
    <span class="cond">{{ info.condition }}</span>
    <span v-if="info.temperature" class="temp">{{ info.temperature }}</span>
    <span v-if="info.humidity" class="humidity">{{ info.humidity }}</span>
  </div>
</template>

<style scoped>
.weather {
  display: flex;
  align-items: baseline;
  gap: 0.6em;
  font-size: clamp(18px, 2.4cqw, 36px);
}
.temp { font-weight: 600; }
.humidity { opacity: 0.6; font-size: 0.7em; }
</style>
