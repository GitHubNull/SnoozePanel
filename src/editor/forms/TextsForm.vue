<script setup lang="ts">
import { computed } from 'vue';
import type { TextComponent, ComponentLayout } from '@/core/types';
import { attachHexHash } from '@/core/config';
import InputText from 'primevue/inputtext';
import InputNumber from 'primevue/inputnumber';
import Button from 'primevue/button';
import ColorPicker from 'primevue/colorpicker';

const props = defineProps<{
  modelValue: TextComponent[];
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: TextComponent[]): void;
}>();

const list = computed<TextComponent[]>(() => props.modelValue);

const DEFAULT_TEXT_LAYOUT: ComponentLayout = { x: 15, y: 10, w: 30 };

function update(next: TextComponent[]): void {
  emit('update:modelValue', next);
}

function addRow(): void {
  update([...list.value, { content: '', layout: { ...DEFAULT_TEXT_LAYOUT } }]);
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

function patchLayout(idx: number, patch: Partial<ComponentLayout>): void {
  const next = list.value.slice();
  next[idx] = { ...next[idx], layout: { ...next[idx].layout, ...patch } };
  update(next);
}

function colorModel(row: TextComponent): string {
  return row.color ?? '';
}

function setColor(row: TextComponent, v: string): void {
  // 同 EditorApp：ColorPicker 输出裸 hex，需补 '#' 否则配置层会丢弃该颜色
  const s = attachHexHash(String(v ?? '')).trim();
  row.color = s || undefined;
}
</script>

<template>
  <div class="texts-form">
    <div class="head">
      <span class="tip">支持实体占位符，如 <code>室温 {'{sensor.temp}'}°C</code></span>
      <Button label="添加文本" icon="pi pi-plus" size="small" text @click="addRow" />
    </div>

    <div v-for="(row, idx) in list" :key="idx" class="text-row">
      <div class="text-main">
        <InputText
          :model-value="row.content"
          placeholder="文本内容，可含 {entity_id} 占位符"
          class="content-input"
          @update:model-value="patchRow(idx, { content: String($event ?? '') })"
        />
        <div class="text-meta">
          <div class="layout-mini">
            <span>X</span>
            <InputNumber
              :model-value="row.layout.x"
              :min="0" :max="100" suffix="%"
              @update:model-value="patchLayout(idx, { x: Number($event ?? 0) })"
            />
          </div>
          <div class="layout-mini">
            <span>Y</span>
            <InputNumber
              :model-value="row.layout.y"
              :min="0" :max="100" suffix="%"
              @update:model-value="patchLayout(idx, { y: Number($event ?? 0) })"
            />
          </div>
          <div class="layout-mini">
            <span>宽</span>
            <InputNumber
              :model-value="row.layout.w"
              :min="5" :max="100" suffix="%"
              @update:model-value="patchLayout(idx, { w: Number($event ?? 30) })"
            />
          </div>
          <ColorPicker
            :model-value="colorModel(row)"
            format="hex"
            @update:model-value="setColor(row, String($event ?? ''))"
          />
          <Button icon="pi pi-trash" size="small" text severity="danger" @click="removeRow(idx)" />
        </div>
      </div>
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
  margin-bottom: 12px;
  padding: 10px;
  border: 1px solid var(--divider-color, #e0e0e0);
  border-radius: 8px;
}
.text-main {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.content-input { width: 100%; }
.text-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.layout-mini {
  display: flex;
  align-items: center;
  gap: 4px;
}
.layout-mini span {
  font-size: 11px;
  color: var(--secondary-text-color, #888);
  min-width: 14px;
}
.layout-mini :deep(.p-inputnumber) {
  width: 70px;
}
.layout-mini :deep(.p-inputnumber-input) {
  width: 100%;
  font-size: 12px;
  padding: 4px 6px;
}
.empty { color: var(--secondary-text-color, #999); font-size: 13px; font-style: italic; }
</style>
