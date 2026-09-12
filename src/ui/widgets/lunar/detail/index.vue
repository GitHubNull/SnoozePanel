<script setup lang="ts">
/**
 * 农历·详版农历（内置样式）。
 *
 * 分段展示：农历月日（format 模板）+ 干支纪年 + 生肖，三段以点号间隔。
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
const main = computed(() => formatLunar(props.now, format.value));
const ganzhi = computed(() => formatLunar(props.now, '{ganzhi}'));
const zodiac = computed(() => formatLunar(props.now, '{zodiac}'));
</script>

<template>
  <div v-if="main" class="lunar-detail">
    <span class="main">{{ main }}</span>
    <span v-if="ganzhi" class="sep">·</span>
    <span v-if="ganzhi" class="ganzhi">{{ ganzhi }}</span>
    <span v-if="zodiac" class="sep">·</span>
    <span v-if="zodiac" class="zodiac">{{ zodiac }}</span>
  </div>
</template>

<style scoped>
.lunar-detail {
  display: flex;
  align-items: baseline;
  gap: 0.4em;
  font-size: clamp(14px, 2cqw, 30px);
  letter-spacing: 0.04em;
}
.main { opacity: 0.9; }
.ganzhi { opacity: 0.7; }
.zodiac { opacity: 0.7; }
.sep { opacity: 0.35; }
</style>
