<script setup lang="ts">
/**
 * 天气·精简天气（第三方样例样式）。
 *
 * 用于验证第三方组件加载：仅以醒目大字号展示温度，状况以小字附于其下。
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
  return {
    condition: CONDITION_CN[s.state] ?? s.state,
    temperature: typeof temp === 'number' ? `${Math.round(temp)}°` : '',
  };
});
</script>

<template>
  <div v-if="info" class="weather-minimal">
    <span v-if="info.temperature" class="temp">{{ info.temperature }}</span>
    <span class="cond">{{ info.condition }}</span>
  </div>
</template>

<style scoped>
.weather-minimal {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  line-height: 1.05;
  color: var(--snooze-accent, #5ea0ff);
}
.temp {
  font-size: clamp(26px, 3.6cqw, 54px);
  font-weight: 800;
  letter-spacing: -0.02em;
}
.cond {
  font-size: clamp(12px, 1.4cqw, 20px);
  opacity: 0.7;
  letter-spacing: 0.14em;
}
</style>
