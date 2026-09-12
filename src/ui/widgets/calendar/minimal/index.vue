<script setup lang="ts">
/**
 * 日历·极简日历（内置样式）。
 *
 * 不渲染整月网格，仅展示大号「月日 + 星期」，适合作为装饰性日期标题。
 * 从 options 读取 format；缺省使用「M月D日」。
 */
import { computed } from 'vue';
import { formatDate } from '@/core/clock';
import type { WidgetProps } from '@/ui/widgets/types';

const props = defineProps<WidgetProps>();

const format = computed<string>(() =>
  typeof props.options.format === 'string' && props.options.format ? props.options.format : 'M月D日',
);
const dateText = computed(() => formatDate(props.now, format.value));
const weekText = computed(() => formatDate(props.now, 'dddd'));
</script>

<template>
  <div class="cal-minimal">
    <div class="date">{{ dateText }}</div>
    <div class="week">{{ weekText }}</div>
  </div>
</template>

<style scoped>
.cal-minimal {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.15em;
}
.date {
  font-size: clamp(20px, 5cqw, 72px);
  font-weight: 700;
  letter-spacing: 0.02em;
}
.week {
  font-size: clamp(12px, 1.8cqw, 24px);
  opacity: 0.6;
  letter-spacing: 0.3em;
  text-indent: 0.3em;
}
</style>
