<script setup lang="ts">
/**
 * 插件菜单栏「高级」浮层：整体 / 单组件显隐表达式。
 */
import { computed } from 'vue';
import Textarea from 'primevue/textarea';

const props = defineProps<{
  displayTemplate: string | null;
  componentTemplates: Record<string, string>;
}>();

const emit = defineEmits<{
  (e: 'update:displayTemplate', value: string | null): void;
  (e: 'update:componentTemplates', value: Record<string, string>): void;
}>();

/** 空串归一为 null（表示不启用表达式） */
const display = computed<string>({
  get: () => props.displayTemplate ?? '',
  set: (v) => emit('update:displayTemplate', String(v ?? '').trim() || null),
});

/** JSON 文本：解析失败（输入未完成）时保留旧值，不打断输入 */
const templates = computed<string>({
  get: () =>
    Object.keys(props.componentTemplates).length
      ? JSON.stringify(props.componentTemplates, null, 2)
      : '',
  set: (v) => {
    const text = String(v ?? '').trim();
    try {
      emit('update:componentTemplates', text ? (JSON.parse(text) as Record<string, string>) : {});
    } catch {
      // JSON 未输入完整：忽略本次输入
    }
  },
});
</script>

<template>
  <div class="panel">
    <div class="field">
      <label>整体显隐表达式（display_template）</label>
      <Textarea
        v-model="display"
        rows="3"
        class="w-full code"
        placeholder="states['binary_sensor.someone_home'].state === 'on'"
      />
      <small>JS 表达式，可用变量：hass、states、user。出错时默认显示。</small>
    </div>
    <div class="field">
      <label>单组件显隐表达式（JSON，可选）</label>
      <Textarea
        v-model="templates"
        rows="4"
        class="w-full code"
        placeholder='{"clock": "user.is_admin", "weather": "true"}'
      />
      <small>键为组件标识（clock / calendar / lunar / weather / text_N），值为 JS 表达式。</small>
    </div>
  </div>
</template>

<style scoped src="./panel.css"></style>
