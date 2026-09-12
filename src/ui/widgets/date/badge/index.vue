<script setup lang="ts">
/**
 * 日期·胶囊日期（内置样式）。
 *
 * 将日期文本放进带描边与淡底的胶囊容器，视觉更聚焦。
 * 从 options 读取 format；缺省使用「YYYY年MM月DD日 dddd」。
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
  <div class="date-badge">{{ text }}</div>
</template>

<style scoped>
.date-badge {
  display: inline-block;
  padding: 0.32em 0.9em;
  border: 1px solid color-mix(in srgb, var(--snooze-text, #d8dcdf) 35%, transparent);
  border-radius: 999px;
  background: color-mix(in srgb, var(--snooze-text, #d8dcdf) 8%, transparent);
  font-size: clamp(15px, 2cqw, 30px);
  letter-spacing: 0.04em;
  white-space: nowrap;
}
</style>
