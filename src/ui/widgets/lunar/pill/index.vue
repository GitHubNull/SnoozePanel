<script setup lang="ts">
/**
 * 农历·胶囊农历（内置样式）。
 *
 * 将农历文本放进圆形淡底容器，作为点缀式农历标注。
 * 从 options 读取 format；缺省使用「{lunar_month}{lunar_day}」。
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
  <div v-if="text" class="lunar-pill">{{ text }}</div>
</template>

<style scoped>
.lunar-pill {
  display: inline-block;
  padding: 0.28em 0.85em;
  border-radius: 999px;
  background: color-mix(in srgb, var(--snooze-accent, #5ea0ff) 18%, transparent);
  color: var(--snooze-accent, #5ea0ff);
  font-size: clamp(15px, 2cqw, 28px);
  letter-spacing: 0.08em;
  white-space: nowrap;
}
</style>
