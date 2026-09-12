<script setup lang="ts">
import { computed } from 'vue';
import type { EntityCondition } from '@/core/types';
import type { HassLike } from '@/core/hass';
import InputText from 'primevue/inputtext';
import InputNumber from 'primevue/inputnumber';
import Button from 'primevue/button';
import Select from 'primevue/select';

const props = defineProps<{
  modelValue: EntityCondition[] | undefined;
  hass: HassLike | null;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: EntityCondition[] | undefined): void;
}>();

const list = computed<EntityCondition[]>(() => props.modelValue ?? []);

// 实体候选
const entityOptions = computed(() => {
  if (!props.hass) return [];
  return Object.keys(props.hass.states).sort();
});

function update(next: EntityCondition[]): void {
  emit('update:modelValue', next.length ? next : undefined);
}

function addRow(): void {
  update([...list.value, { entity: '' }]);
}

function removeRow(idx: number): void {
  const next = list.value.slice();
  next.splice(idx, 1);
  update(next);
}

function patchRow(idx: number, patch: Partial<EntityCondition>): void {
  const next = list.value.slice();
  next[idx] = { ...next[idx], ...patch };
  update(next);
}
</script>

<template>
  <div class="entity-conds">
    <div class="head">
      <label>实体条件</label>
      <Button label="添加" icon="pi pi-plus" size="small" text @click="addRow" />
    </div>
    <p class="hint">多个条件为「与」关系。每行可填 state / above / below 之一或组合。</p>

    <div v-for="(row, idx) in list" :key="idx" class="cond-row">
      <Select
        :model-value="row.entity"
        :options="entityOptions"
        editable
        filter
        placeholder="实体 id"
        class="entity-input"
        @update:model-value="patchRow(idx, { entity: String($event ?? '') })"
      />
      <InputText
        :model-value="row.state ?? ''"
        placeholder="state"
        class="num-input"
        @update:model-value="patchRow(idx, { state: String($event ?? '') || undefined })"
      />
      <InputNumber
        :model-value="row.above"
        placeholder="above"
        class="num-input"
        @update:model-value="patchRow(idx, { above: $event === null ? undefined : $event })"
      />
      <InputNumber
        :model-value="row.below"
        placeholder="below"
        class="num-input"
        @update:model-value="patchRow(idx, { below: $event === null ? undefined : $event })"
      />
      <Button icon="pi pi-trash" size="small" text severity="danger" @click="removeRow(idx)" />
    </div>
    <p v-if="list.length === 0" class="empty">未设置实体条件</p>
  </div>
</template>

<style scoped>
.entity-conds { margin-bottom: 18px; }
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.head label { font-weight: 600; font-size: 14px; }
.hint { color: var(--secondary-text-color, #888); font-size: 12px; margin: 4px 0 10px; }
.cond-row {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1fr auto;
  gap: 8px;
  margin-bottom: 8px;
  align-items: center;
}
.entity-input { min-width: 0; }
.num-input { width: 100%; }
.empty { color: var(--secondary-text-color, #999); font-size: 13px; font-style: italic; }
</style>
