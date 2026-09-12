<script setup lang="ts">
/**
 * 插件菜单栏「条件」浮层：实体条件 / 时间段 / 日出日落（三者「与」关系）。
 */
import { computed } from 'vue';
import type { Conditions, TimeCondition, SunCondition, Weekday } from '@/core/types';
import type { HassLike } from '@/core/hass';
import EntityConditionsForm from '../forms/EntityConditionsForm.vue';
import InputText from 'primevue/inputtext';
import InputNumber from 'primevue/inputnumber';
import ToggleSwitch from 'primevue/toggleswitch';
import Chip from 'primevue/chip';

const props = defineProps<{
  conditions: Conditions;
  hass: HassLike | null;
}>();

const emit = defineEmits<{
  (e: 'update:conditions', value: Conditions): void;
}>();

const WEEKDAYS = [
  { label: '一', value: 'mon' },
  { label: '二', value: 'tue' },
  { label: '三', value: 'wed' },
  { label: '四', value: 'thu' },
  { label: '五', value: 'fri' },
  { label: '六', value: 'sat' },
  { label: '日', value: 'sun' },
];

/** 条件字段补丁：整体替换对象，避免直接修改 prop */
function patch(p: Partial<Conditions>): void {
  emit('update:conditions', { ...props.conditions, ...p });
}

const entityModel = computed<Conditions['entity']>({
  get: () => props.conditions.entity,
  set: (v) => patch({ entity: v }),
});

const timeEnabled = computed<boolean>({
  get: () => props.conditions.time !== undefined,
  set: (on) => patch({ time: on ? { after: '21:00', before: '07:00' } : undefined }),
});

function patchTime(p: Partial<TimeCondition>): void {
  const cur = props.conditions.time;
  if (!cur) return;
  patch({ time: { ...cur, ...p } });
}

/** 已选星期（不选 = 每天） */
const weekdaySelection = computed<string[]>(() => (props.conditions.time?.weekday ?? []) as string[]);

function toggleWeekday(value: string): void {
  const cur = props.conditions.time;
  if (!cur) return;
  const list = [...((cur.weekday ?? []) as string[])];
  const idx = list.indexOf(value);
  if (idx >= 0) list.splice(idx, 1);
  else list.push(value);
  patchTime({ weekday: list as Weekday[] });
}

const sunEnabled = computed<boolean>({
  get: () => props.conditions.sun !== undefined,
  set: (on) => patch({ sun: on ? { after_sunset_offset: 0 } : undefined }),
});

function patchSun(p: Partial<SunCondition>): void {
  const cur = props.conditions.sun;
  if (!cur) return;
  patch({ sun: { ...cur, ...p } });
}
</script>

<template>
  <div class="panel">
    <p class="hint">以下条件为「与」关系，全部满足才会进入屏保；屏保中条件失效会立即退出。</p>

    <EntityConditionsForm v-model="entityModel" :hass="hass" />

    <div class="inline-row">
      <label>时间段限制</label>
      <ToggleSwitch v-model="timeEnabled" />
    </div>
    <template v-if="conditions.time">
      <div class="field-row">
        <div class="field">
          <label>晚于（HH:mm）</label>
          <InputText
            :model-value="conditions.time.after ?? ''"
            placeholder="21:00"
            class="w-full"
            @update:model-value="patchTime({ after: String($event ?? '') || undefined })"
          />
        </div>
        <div class="field">
          <label>早于（HH:mm）</label>
          <InputText
            :model-value="conditions.time.before ?? ''"
            placeholder="07:00"
            class="w-full"
            @update:model-value="patchTime({ before: String($event ?? '') || undefined })"
          />
        </div>
      </div>
      <div class="field">
        <label>限定星期（不选=每天）</label>
        <div class="weekday-chips">
          <Chip
            v-for="w in WEEKDAYS"
            :key="w.value"
            :label="w.label"
            :class="{ active: weekdaySelection.includes(w.value) }"
            @click="toggleWeekday(w.value)"
          />
        </div>
      </div>
    </template>

    <div class="inline-row">
      <label>日出日落限制</label>
      <ToggleSwitch v-model="sunEnabled" />
    </div>
    <template v-if="conditions.sun">
      <div class="field">
        <label>日落后偏移（分钟，可负）</label>
        <InputNumber
          :model-value="conditions.sun.after_sunset_offset ?? 0"
          :min="-180"
          :max="720"
          show-buttons
          @update:model-value="patchSun({ after_sunset_offset: Number($event ?? 0) })"
        />
      </div>
      <div class="field">
        <label>日出前偏移（分钟）</label>
        <InputNumber
          :model-value="conditions.sun.before_sunrise_offset ?? 0"
          :min="-180"
          :max="720"
          show-buttons
          @update:model-value="patchSun({ before_sunrise_offset: Number($event ?? 0) })"
        />
      </div>
    </template>
  </div>
</template>

<style scoped src="./panel.css"></style>
