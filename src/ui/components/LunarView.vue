<script setup lang="ts">
import { computed } from 'vue';
import { formatLunar } from '@/core/lunar';

const props = defineProps<{
  now: Date;
  format: string;
}>();

const text = computed(() => formatLunar(props.now, props.format));
</script>

<template>
  <div v-if="text" class="lunar">{{ text }}</div>
</template>

<style scoped>
.lunar {
  font-size: clamp(16px, 2.2cqw, 32px);
  opacity: 0.85;
  letter-spacing: 0.05em;
}
</style>
