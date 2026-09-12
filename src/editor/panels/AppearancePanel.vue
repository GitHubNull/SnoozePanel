<script setup lang="ts">
/**
 * 插件菜单栏「外观」浮层：主题与背景（纯色 / 渐变 / 图片轮播 / 暗化遮罩）。
 */
import { computed } from 'vue';
import type { Background } from '@/core/types';
import Select from 'primevue/select';
import InputText from 'primevue/inputtext';
import InputNumber from 'primevue/inputnumber';
import Slider from 'primevue/slider';
import Textarea from 'primevue/textarea';

const props = defineProps<{
  theme: 'midnight' | 'paper';
  background: Background;
}>();

const emit = defineEmits<{
  (e: 'update:theme', value: 'midnight' | 'paper'): void;
  (e: 'update:background', value: Background): void;
}>();

const THEMES = [
  { label: '深夜（深色）', value: 'midnight' },
  { label: '宣纸（浅色）', value: 'paper' },
];

const BG_TYPES = [
  { label: '纯色', value: 'color' },
  { label: '渐变', value: 'gradient' },
  { label: '图片轮播', value: 'image' },
];

const theme = computed<string>({
  get: () => props.theme,
  set: (v) => emit('update:theme', (String(v ?? 'midnight') === 'paper' ? 'paper' : 'midnight')),
});

/** 背景字段补丁：整体替换对象，避免直接修改 prop */
function patchBackground(patch: Partial<Background>): void {
  emit('update:background', { ...props.background, ...patch });
}

function patchGradient(patch: Partial<Background['gradient']>): void {
  patchBackground({ gradient: { ...props.background.gradient, ...patch } });
}

const bgType = computed<string>({
  get: () => props.background.type,
  set: (v) => patchBackground({ type: String(v ?? 'color') as Background['type'] }),
});

/** 图片地址列表文本（每行一张） */
const imagesText = computed<string>({
  get: () => props.background.images.join('\n'),
  set: (v) =>
    patchBackground({
      images: String(v ?? '')
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
    }),
});
</script>

<template>
  <div class="panel">
    <div class="field">
      <label>主题</label>
      <Select v-model="theme" :options="THEMES" option-label="label" option-value="value" class="w-full" />
      <small>决定屏保默认字体与强调色（组件单独设置的颜色会覆盖主题色）</small>
    </div>

    <div class="field">
      <label>背景类型</label>
      <Select v-model="bgType" :options="BG_TYPES" option-label="label" option-value="value" class="w-full" />
    </div>

    <div v-if="background.type === 'color'" class="field">
      <label>颜色</label>
      <InputText
        :model-value="background.color"
        class="w-full"
        placeholder="#0b1020"
        @update:model-value="patchBackground({ color: String($event ?? '') })"
      />
    </div>

    <template v-if="background.type === 'gradient'">
      <div class="field">
        <label>起始色</label>
        <InputText
          :model-value="background.gradient.from"
          class="w-full"
          @update:model-value="patchGradient({ from: String($event ?? '') })"
        />
      </div>
      <div class="field">
        <label>结束色</label>
        <InputText
          :model-value="background.gradient.to"
          class="w-full"
          @update:model-value="patchGradient({ to: String($event ?? '') })"
        />
      </div>
      <div class="field">
        <label>角度（{{ background.gradient.angle }}°）</label>
        <Slider
          :model-value="background.gradient.angle"
          :min="0"
          :max="360"
          @update:model-value="patchGradient({ angle: Number($event ?? 0) })"
        />
      </div>
    </template>

    <template v-if="background.type === 'image'">
      <div class="field">
        <label>图片地址（每行一张，多张轮播）</label>
        <Textarea v-model="imagesText" rows="4" class="w-full" placeholder="/local/bg1.jpg&#10;/local/bg2.jpg" />
      </div>
      <div class="field">
        <label>轮播间隔（秒）</label>
        <InputNumber
          :model-value="background.interval_seconds"
          :min="3"
          :max="600"
          show-buttons
          @update:model-value="patchBackground({ interval_seconds: Number($event ?? 30) })"
        />
      </div>
    </template>

    <div class="field">
      <label>暗化遮罩（{{ Math.round(background.dim * 100) }}%）</label>
      <Slider
        :model-value="background.dim"
        :min="0"
        :max="1"
        :step="0.05"
        @update:model-value="patchBackground({ dim: Number($event ?? 0) })"
      />
      <small>压暗背景，保证前景文字可读</small>
    </div>
  </div>
</template>

<style scoped src="./panel.css"></style>
