<script setup lang="ts">
/**
 * 文本·滚动文本（第三方样例样式）。
 *
 * 用于验证第三方组件加载：以单行溢出横向滚动的跑马灯呈现长文本。
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
  <div class="custom-text-marquee">
    <span class="track">{{ text }}</span>
  </div>
</template>

<style scoped>
.custom-text-marquee {
  max-width: 100%;
  overflow: hidden;
  white-space: nowrap;
  color: var(--snooze-accent, #5ea0ff);
}
.track {
  display: inline-block;
  font-size: clamp(15px, 1.9cqw, 28px);
  letter-spacing: 0.06em;
  animation: marquee 12s linear infinite;
}
@keyframes marquee {
  from { transform: translateX(0); }
  to { transform: translateX(-50%); }
}
</style>
