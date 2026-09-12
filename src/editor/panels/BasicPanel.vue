<script setup lang="ts">
/**
 * 插件菜单栏「基础」浮层：闲置触发时长 / 退出冷却 / 远程控制实体。
 */
import { computed } from 'vue';
import InputNumber from 'primevue/inputnumber';
import InputText from 'primevue/inputtext';

const props = defineProps<{
  idleSeconds: number;
  exitCooldown: number;
  screensaverEntity: string | null;
}>();

const emit = defineEmits<{
  (e: 'update:idleSeconds', value: number): void;
  (e: 'update:exitCooldown', value: number): void;
  (e: 'update:screensaverEntity', value: string | null): void;
}>();

const idle = computed<number>({
  get: () => props.idleSeconds,
  set: (v) => emit('update:idleSeconds', Number(v ?? 0)),
});

const cooldown = computed<number>({
  get: () => props.exitCooldown,
  set: (v) => emit('update:exitCooldown', Number(v ?? 0)),
});

/** 空串归一为 null（表示未配置远程实体） */
const entity = computed<string>({
  get: () => props.screensaverEntity ?? '',
  set: (v) => emit('update:screensaverEntity', String(v ?? '').trim() || null),
});
</script>

<template>
  <div class="panel">
    <div class="field">
      <label>闲置触发时长（秒）</label>
      <InputNumber v-model="idle" :min="5" :max="3600" show-buttons />
      <small>无触摸 / 按键操作多少秒后进入屏保</small>
    </div>
    <div class="field">
      <label>退出冷却（秒）</label>
      <InputNumber v-model="cooldown" :min="0" :max="30" show-buttons />
      <small>进入屏保后短暂忽略触摸，防误触退出</small>
    </div>
    <div class="field">
      <label>远程控制实体（input_boolean，可选）</label>
      <InputText v-model="entity" placeholder="input_boolean.screensaver" class="w-full" />
      <small>置 on 强制进入屏保，触摸退出时自动复位为 off</small>
    </div>
  </div>
</template>

<style scoped src="./panel.css"></style>
