<script setup lang="ts">
/**
 * 农历·印章农历（第三方样例样式）。
 *
 * 用于验证第三方组件加载：以方形描边「印章」框呈现农历月日。
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
  <div v-if="text" class="lunar-seal">{{ text }}</div>
</template>

<style scoped>
.lunar-seal {
  display: inline-block;
  padding: 0.4em 0.55em;
  border: 2px solid var(--snooze-accent, #5ea0ff);
  border-radius: 8px;
  color: var(--snooze-accent, #5ea0ff);
  font-size: clamp(14px, 1.9cqw, 26px);
  line-height: 1.15;
  letter-spacing: 0.06em;
  text-align: center;
  writing-mode: vertical-rl;
  text-orientation: upright;
}
</style>
