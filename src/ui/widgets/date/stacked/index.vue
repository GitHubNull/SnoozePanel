<script setup lang="ts">
/**
 * 日期·堆叠日期（内置样式）。
 *
 * 日期与星期分两行展示：上行为日期（format 模板），下行为放大字距的星期。
 * 从 options 读取 format；缺省使用「YYYY年MM月DD日」。
 */
import { computed } from 'vue';
import { formatDate } from '@/core/clock';
import type { WidgetProps } from '@/ui/widgets/types';

const props = defineProps<WidgetProps>();

const format = computed<string>(() =>
  typeof props.options.format === 'string' && props.options.format
    ? props.options.format
    : 'YYYY年MM月DD日',
);
const dateText = computed(() => formatDate(props.now, format.value));
const weekText = computed(() => formatDate(props.now, 'dddd'));
</script>

<template>
  <div class="date-stacked">
    <div class="line1">{{ dateText }}</div>
    <div class="line2">{{ weekText }}</div>
  </div>
</template>

<style scoped>
.date-stacked {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.12em;
  text-align: center;
}
.line1 {
  font-size: clamp(16px, 2.2cqw, 32px);
  letter-spacing: 0.03em;
}
.line2 {
  font-size: clamp(12px, 1.6cqw, 22px);
  opacity: 0.6;
  letter-spacing: 0.32em;
  text-indent: 0.32em;
}
</style>
