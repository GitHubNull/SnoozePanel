<script setup lang="ts">
/**
 * 天气·卡片天气（内置样式）。
 *
 * 以带淡底圆角卡片呈现：上方为天气状况，下方为温度与湿度。
 * 从 options 读取 entity（weather.* 实体 id）。
 */
import { computed } from 'vue';
import type { WidgetProps } from '@/ui/widgets/types';

const props = defineProps<WidgetProps>();

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

const entity = computed<string>(() =>
  typeof props.options.entity === 'string' ? props.options.entity : '',
);

const info = computed(() => {
  const s = props.hass.states[entity.value];
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
  <div v-if="info" class="weather-card">
    <span class="cond">{{ info.condition }}</span>
    <div class="row">
      <span v-if="info.temperature" class="temp">{{ info.temperature }}</span>
      <span v-if="info.humidity" class="humidity">{{ info.humidity }}</span>
    </div>
  </div>
</template>

<style scoped>
.weather-card {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: 0.35em;
  padding: 0.6em 1.1em;
  border-radius: 14px;
  background: color-mix(in srgb, var(--snooze-accent, #5ea0ff) 12%, transparent);
}
.cond {
  font-size: clamp(14px, 1.7cqw, 26px);
  opacity: 0.75;
  letter-spacing: 0.06em;
}
.row {
  display: flex;
  align-items: baseline;
  gap: 0.5em;
}
.temp {
  font-size: clamp(20px, 2.8cqw, 42px);
  font-weight: 700;
}
.humidity {
  font-size: clamp(12px, 1.4cqw, 20px);
  opacity: 0.6;
}
</style>
