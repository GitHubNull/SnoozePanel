<script setup lang="ts">
import { computed } from 'vue';
import type { TextComponent, GridPosition } from '@/core/types';
import InputText from 'primevue/inputtext';
import Dropdown from 'primevue/dropdown';
import Button from 'primevue/button';

const props = defineProps<{
  modelValue: TextComponent[];
  positions: { label: string; value: GridPosition }[];
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: TextComponent[]): void;
}>();

const list = computed<TextComponent[]>(() => props.modelValue);

function update(next: TextComponent[]): void {
  emit('update:modelValue', next);
}

function addRow(): void {
  update([...list.value, { content: '', position: 'bottom_left' }]);
}

function removeRow(idx: number): void {
  const next = list.value.slice();
  next.splice(idx, 1);
  update(next);
}

function patchRow(idx: number, patch: Partial<TextComponent>): void {
  const next = list.value.slice();
  next[idx] = { ...next[idx], ...patch };
  update(next);
}
</script>

<template>
  <div class="texts-form">
    <div class="head">
      <span class="tip">支持实体占位符，如 <code>室温 {'{sensor.temp}'}°C</code></span>
      <Button label="添加文本" icon="pi pi-plus" size="small" text @click="addRow" />
    </div>

    <div v-for="(row, idx) in list" :key="idx" class="text-row">
      <InputText
        :model-value="row.content"
        placeholder="文本内容，可含 {entity_id} 占位符"
        class="content-input"
        @update:model-value="patchRow(idx, { content: String($event ?? '') })"
      />
      <Dropdown
        :model-value="row.position"
        :options="positions"
        option-label="label"
        option-value="value"
        class="pos-input"
        @update:model-value="patchRow(idx, { position: $event as GridPosition })"
      />
      <Button icon="pi pi-trash" size="small" text severity="danger" @click="removeRow(idx)" />
    </div>
    <p v-if="list.length === 0" class="empty">未添加自定义文本</p>
  </div>
</template>

<style scoped>
.texts-form { width: 100%; }
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}
.tip { color: var(--secondary-text-color, #888); font-size: 12px; }
.text-row {
  display: grid;
  grid-template-columns: 1fr 140px auto;
  gap: 8px;
  margin-bottom: 8px;
  align-items: center;
}
.content-input { min-width: 0; }
.empty { color: var(--secondary-text-color, #999); font-size: 13px; font-style: italic; }
</style>
