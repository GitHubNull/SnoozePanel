<script setup lang="ts">
/**
 * 日期·霓虹日期（第三方样例样式）。
 *
 * 用于验证第三方组件加载：以强调色发光字效渲染日期。
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
  <div class="date-neon">{{ text }}</div>
</template>

<style scoped>
.date-neon {
  font-size: clamp(16px, 2.4cqw, 34px);
  font-weight: 700;
  letter-spacing: 0.06em;
  color: var(--snooze-accent, #5ea0ff);
  text-shadow:
    0 0 6px color-mix(in srgb, var(--snooze-accent, #5ea0ff) 70%, transparent),
    0 0 16px color-mix(in srgb, var(--snooze-accent, #5ea0ff) 45%, transparent);
}
</style>
