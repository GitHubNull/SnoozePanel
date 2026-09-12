<script setup lang="ts">
/**
 * 农历·基础农历（内置样式，默认）。
 *
 * 从 options 读取 format（农历格式模板，占位符 {lunar_month}{lunar_day}{ganzhi}{zodiac}）。
 */
import { computed } from 'vue';
import { formatLunar } from '@/core/lunar';
import type { WidgetProps } from '@/ui/widgets/types';

const props = defineProps<WidgetProps>();

const format = computed<string>(() =>
  typeof props.options.format === 'string' && props.options.format
    ? props.options.format
    : '{lunar_month}{lunar_day}',
);
const text = computed(() => formatLunar(props.now, format.value));
</script>

<template>
  <div v-if="text" class="lunar">{{ text }}</div>
</template>

<style scoped>
.lunar {
  font-size: clamp(16px, 2.2cqw, 32px);
  opacity: 0.85;
  letter-spacing: 0.05em;
}
</style>
