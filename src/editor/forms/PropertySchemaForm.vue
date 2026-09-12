<script setup lang="ts">
/**
 * 元数据驱动的属性表单：按 PropertyField[] schema 渲染控件并写回。
 *
 * 控件映射：color→ColorPicker+文本、number→InputNumber、boolean→ToggleSwitch、
 * select→Select、text→InputText（有候选则用可编辑 Select）、textarea→Textarea。
 * 读写经 read/write 回调（由 useComponentSelection 提供，自动区分 bind:'option'/'field'）。
 * 字段按 group 分组展示。
 */
import { computed } from 'vue';
import { attachHexHash } from '@/core/config';
import InputText from 'primevue/inputtext';
import InputNumber from 'primevue/inputnumber';
import Textarea from 'primevue/textarea';
import Select from 'primevue/select';
import ToggleSwitch from 'primevue/toggleswitch';
import ColorPicker from 'primevue/colorpicker';
import type { PropertyField } from '@/ui/plugins/types';

const props = withDefaults(
  defineProps<{
    /** 字段 schema */
    schema: PropertyField[];
    /** 读值回调 */
    read: (field: PropertyField) => unknown;
    /** 写值回调 */
    write: (field: PropertyField, value: unknown) => void;
    /** text 字段候选值（key → 候选列表），有候选时渲染为可编辑 Select */
    suggestions?: Record<string, string[]>;
  }>(),
  { suggestions: () => ({}) },
);

/** 按 group 分组（无 group 的归入默认组，排在最后） */
const groups = computed<{ name: string; fields: PropertyField[] }[]>(() => {
  const map = new Map<string, PropertyField[]>();
  for (const f of props.schema) {
    const g = f.group ?? '';
    const arr = map.get(g);
    if (arr) arr.push(f);
    else map.set(g, [f]);
  }
  return Array.from(map.entries())
    .sort((a, b) => (a[0] === '' ? 1 : 0) - (b[0] === '' ? 1 : 0))
    .map(([name, fields]) => ({ name, fields }));
});

function getValue(field: PropertyField): unknown {
  return props.read(field);
}
function setValue(field: PropertyField, value: unknown): void {
  props.write(field, value);
}

/** 数值控件值（非数字回退 undefined，交由占位/默认处理） */
function numberValue(field: PropertyField): number | undefined {
  const v = getValue(field);
  return typeof v === 'number' ? v : undefined;
}
/** 布尔控件值（缺省回退 schema.default） */
function boolValue(field: PropertyField): boolean {
  const v = getValue(field);
  if (typeof v === 'boolean') return v;
  return typeof field.default === 'boolean' ? field.default : false;
}
/** 字符串控件值 */
function textValue(field: PropertyField): string {
  const v = getValue(field);
  return v === undefined || v === null ? '' : String(v);
}
/** 颜色控件值 */
function colorValue(field: PropertyField): string {
  return textValue(field);
}

function onColor(field: PropertyField, v: unknown): void {
  setValue(field, attachHexHash(String(v ?? '')));
}
</script>

<template>
  <div v-if="schema.length === 0" class="schema-empty">当前组件暂无可配置属性</div>
  <div v-for="group in groups" :key="group.name" class="schema-group">
    <div v-if="group.name" class="schema-group-title">{{ group.name }}</div>
    <template v-for="field in group.fields" :key="field.key">
      <!-- 布尔 -->
      <div v-if="field.type === 'boolean'" class="inline-row">
        <label>{{ field.label }}</label>
        <ToggleSwitch :model-value="boolValue(field)" @update:model-value="setValue(field, $event)" />
      </div>

      <!-- 颜色 -->
      <div v-else-if="field.type === 'color'" class="field">
        <label>{{ field.label }}</label>
        <div class="color-row">
          <ColorPicker :model-value="colorValue(field)" format="hex" @update:model-value="onColor(field, $event)" />
          <InputText
            :model-value="colorValue(field)"
            placeholder="留空用主题色"
            class="color-input"
            @update:model-value="setValue(field, String($event ?? ''))"
          />
        </div>
        <small v-if="field.hint">{{ field.hint }}</small>
      </div>

      <!-- 数值 -->
      <div v-else-if="field.type === 'number'" class="field">
        <label>{{ field.label }}</label>
        <InputNumber
          :model-value="numberValue(field)"
          :min="field.min"
          :max="field.max"
          :step="field.step"
          :suffix="field.suffix"
          class="w-full"
          @update:model-value="setValue(field, $event)"
        />
        <small v-if="field.hint">{{ field.hint }}</small>
      </div>

      <!-- 下拉 -->
      <div v-else-if="field.type === 'select'" class="field">
        <label>{{ field.label }}</label>
        <Select
          :model-value="getValue(field)"
          :options="field.options ?? []"
          option-label="label"
          option-value="value"
          class="w-full"
          @update:model-value="setValue(field, $event)"
        />
        <small v-if="field.hint">{{ field.hint }}</small>
      </div>

      <!-- 文本域 -->
      <div v-else-if="field.type === 'textarea'" class="field">
        <label>{{ field.label }}</label>
        <Textarea
          :model-value="textValue(field)"
          rows="3"
          auto-resize
          class="w-full"
          @update:model-value="setValue(field, $event)"
        />
        <small v-if="field.hint">{{ field.hint }}</small>
      </div>

      <!-- 文本（有候选则用可编辑 Select） -->
      <div v-else class="field">
        <label>{{ field.label }}</label>
        <Select
          v-if="suggestions[field.key] && suggestions[field.key].length"
          :model-value="textValue(field)"
          :options="suggestions[field.key]"
          editable
          class="w-full"
          @update:model-value="setValue(field, $event)"
        />
        <InputText
          v-else
          :model-value="textValue(field)"
          class="w-full"
          @update:model-value="setValue(field, $event)"
        />
        <small v-if="field.hint">{{ field.hint }}</small>
      </div>
    </template>
  </div>
</template>

<style scoped>
.schema-empty {
  font-size: 13px;
  color: var(--sp-chrome-text-dim, #98a0a6);
  padding: 8px 0 16px;
}
.schema-group {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 16px;
}
.schema-group-title {
  font-size: 12px;
  font-weight: 700;
  color: var(--sp-chrome-text-dim, #98a0a6);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.field > label {
  font-size: 13px;
  font-weight: 600;
}
.field small {
  font-size: 12px;
  line-height: 1.5;
  color: var(--sp-chrome-text-dim, #98a0a6);
}
.w-full {
  width: 100%;
}
.inline-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.inline-row > label {
  font-size: 13px;
  font-weight: 600;
}
.color-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.color-input {
  flex: 1;
  font-family: monospace;
  font-size: 13px;
}
</style>
