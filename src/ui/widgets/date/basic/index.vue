<script setup lang="ts">
/**
 * 日期·基础日期（内置样式，默认）。
 *
 * 从 options 读取 format（ISO 8601 风格占位符模板）：
 *   YYYY 四位年 / YY 两位年 / MM 两位月 / M 月 / DD 两位日 / D 日 / dddd 星期全称 / ddd 星期简称。
 * 例："YYYY年MM月DD日 dddd" → "2024年05月01日 周三"。
 */
import { computed } from 'vue';
import { formatDate } from '@/core/clock';
import type { WidgetProps } from '@/ui/widgets/types';

const props = defineProps<WidgetProps>();

const format = computed<string>(() =>
  typeof props.options.format === 'string' && props.options.format
    ? props.options.format
    : 'YYYY年MM月DD日 dddd',
);
const text = computed(() => formatDate(props.now, format.value));
</script>

<template>
  <div class="date">{{ text }}</div>
</template>

<style scoped>
.date {
  font-size: clamp(16px, 2.2cqw, 32px);
  opacity: 0.9;
  letter-spacing: 0.03em;
}
</style>
