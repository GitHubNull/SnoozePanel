<script setup lang="ts">
import { computed } from 'vue';
import { renderText } from '@/core/text';
import type { HassLike } from '@/core/hass';

const props = defineProps<{
  hass: HassLike;
  content: string;
}>();

const text = computed(() => renderText(props.content, props.hass));
</script>

<template>
  <div class="custom-text">{{ text }}</div>
</template>

<style scoped>
.custom-text {
  font-size: clamp(16px, 2vw, 30px);
  opacity: 0.85;
}
</style>
