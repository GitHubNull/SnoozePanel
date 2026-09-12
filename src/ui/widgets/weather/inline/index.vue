<script setup lang="ts">
/**
 * 天气·单行天气（内置样式）。
 *
 * 将天气状况、温度、湿度压缩在单行内以「·」分隔，适合作为行内信息。
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

const parts = computed<string[]>(() => {
  const s = props.hass.states[entity.value];
  if (!s) return [];
  const temp = s.attributes.temperature;
  const humidity = s.attributes.humidity;
  const out = [CONDITION_CN[s.state] ?? s.state];
  if (typeof temp === 'number') out.push(`${Math.round(temp)}°`);
  if (typeof humidity === 'number') out.push(`${Math.round(humidity)}%`);
  return out;
});
</script>

<template>
  <div v-if="parts.length" class="weather-inline">
    <template v-for="(p, i) in parts" :key="i">
      <span v-if="i > 0" class="sep">·</span>
      <span class="part">{{ p }}</span>
    </template>
  </div>
</template>

<style scoped>
.weather-inline {
  display: flex;
  align-items: baseline;
  gap: 0.35em;
  font-size: clamp(15px, 2cqw, 30px);
  white-space: nowrap;
}
.part { opacity: 0.9; }
.sep { opacity: 0.35; }
</style>
