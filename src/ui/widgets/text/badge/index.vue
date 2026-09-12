<script setup lang="ts">
/**
 * 文本·标签文本（内置样式）。
 *
 * 将自定义文本放进胶囊底色的标签容器，适合作为状态标签。
 * 从 options 读取 content（支持实体占位符）。
 */
import { computed } from 'vue';
import { renderText } from '@/core/text';
import type { WidgetProps } from '@/ui/widgets/types';

const props = defineProps<WidgetProps>();

const content = computed<string>(() =>
  typeof props.options.content === 'string' ? props.options.content : '',
);
const text = computed(() => renderText(content.value, props.hass));
</script>

<template>
  <div class="custom-text-badge">{{ text }}</div>
</template>

<style scoped>
.custom-text-badge {
  display: inline-block;
  padding: 0.24em 0.9em;
  border-radius: 999px;
  background: color-mix(in srgb, var(--snooze-accent, #5ea0ff) 16%, transparent);
  color: var(--snooze-accent, #5ea0ff);
  font-size: clamp(14px, 1.8cqw, 26px);
  letter-spacing: 0.04em;
  white-space: nowrap;
}
</style>
