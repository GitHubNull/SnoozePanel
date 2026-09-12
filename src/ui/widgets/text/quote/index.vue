<script setup lang="ts">
/**
 * 文本·强调文本（内置样式）。
 *
 * 以左侧竖线 + 斜体呈现，作为引述式强调文案。
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
  <div class="custom-text-quote">{{ text }}</div>
</template>

<style scoped>
.custom-text-quote {
  padding-left: 0.7em;
  border-left: 3px solid var(--snooze-accent, #5ea0ff);
  font-size: clamp(16px, 2.1cqw, 32px);
  font-style: italic;
  opacity: 0.9;
  line-height: 1.35;
}
</style>
