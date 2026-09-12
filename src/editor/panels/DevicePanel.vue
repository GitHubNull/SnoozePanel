<script setup lang="ts">
/**
 * 插件菜单栏「设备」浮层：设备范围（白/黑名单）与设备级覆盖保存。
 */
import { computed } from 'vue';
import type { DeviceFilter } from '@/core/types';
import Select from 'primevue/select';
import ToggleSwitch from 'primevue/toggleswitch';
import Textarea from 'primevue/textarea';
import Button from 'primevue/button';

const props = defineProps<{
  devices: DeviceFilter | null;
  deviceId: string;
  saving: boolean;
  saved: string;
}>();

const emit = defineEmits<{
  (e: 'update:devices', value: DeviceFilter | null): void;
  (e: 'save'): void;
}>();

const DEVICE_MODES = [
  { label: '白名单（仅列表内设备启用）', value: 'whitelist' },
  { label: '黑名单（列表内设备禁用）', value: 'blacklist' },
];

/** 开关：关闭时清空设备范围（null 表示不限制） */
const enabled = computed<boolean>({
  get: () => props.devices !== null,
  set: (on) => emit('update:devices', on ? { mode: 'whitelist', list: [] } : null),
});

const mode = computed<string>({
  get: () => props.devices?.mode ?? 'whitelist',
  set: (v) => patch({ mode: String(v ?? 'whitelist') as DeviceFilter['mode'] }),
});

/** 名单文本（逗号 / 空格分隔） */
const listText = computed<string>({
  get: () => (props.devices?.list ?? []).join(', '),
  set: (v) =>
    patch({
      list: String(v ?? '')
        .split(/[,，\s]+/)
        .map((s) => s.trim())
        .filter(Boolean),
    }),
});

/** 设备范围字段补丁：整体替换对象，避免直接修改 prop */
function patch(p: Partial<DeviceFilter>): void {
  const cur = props.devices;
  if (!cur) return;
  emit('update:devices', { ...cur, ...p });
}
</script>

<template>
  <div class="panel">
    <div class="inline-row">
      <label>按设备限制</label>
      <ToggleSwitch v-model="enabled" />
    </div>
    <template v-if="devices">
      <div class="field">
        <label>名单模式</label>
        <Select v-model="mode" :options="DEVICE_MODES" option-label="label" option-value="value" class="w-full" />
      </div>
      <div class="field">
        <label>设备 id 列表（逗号分隔）</label>
        <Textarea v-model="listText" rows="3" class="w-full" placeholder="dev-abc123, pad-kitchen" />
      </div>
    </template>

    <div class="field">
      <label>当前设备 id</label>
      <div class="device-id-text">{{ deviceId }}</div>
      <small>把当前配置存为该设备的独立覆盖，落盘到 HA 后端（断电 / 重启 / 清缓存不丢）</small>
    </div>
    <div class="field">
      <Button :loading="saving" label="保存为本设备配置" @click="emit('save')" />
      <span v-if="saved" class="save-hint">{{ saved }}</span>
    </div>
  </div>
</template>

<style scoped src="./panel.css"></style>
