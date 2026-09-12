<script setup lang="ts">
/**
 * 文本·基础文本（内置样式，沿用原单目录实现）。
 *
 * 从 options 读取 content（支持实体占位符 {entity_id} 或 {entity_id:unit}），
 * 通过 renderText 用 hass 当前状态替换后渲染。
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
  <div class="custom-text">{{ text }}</div>
</template>

<style scoped>
.custom-text {
  font-size: clamp(16px, 2cqw, 30px);
  opacity: 0.85;
}
</style>
