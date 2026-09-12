<script setup lang="ts">
/**
 * 内容组件缩略预览：把某个 type+style 的内容组件放进带主题底色的容器中渲染。
 *
 * 原理：内容组件的尺寸均使用 cqw + clamp 容器单位，解析基准为其容器。
 * 这里提供「容器尺寸（container-type: size）+ 居中 flex」的舞台，
 * 并注入一组样例 options 与 mock hass（含 weather.home）+ 1s Ticker 驱动 now，
 * 使任意新增样式无需适配即可获得预览能力。
 *
 * 说明：容器宽度取适中值，配合样式内的 clamp 下限，保证预览文字可读；
 * 预览为近似观感，非逐像素真机一致。
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import type { Component } from 'vue';
import { widgetsVersion, getWidget } from '@/ui/widgets/registry';
import { getTheme } from '@/ui/themes';
import type { HassLike } from '@/core/hass';
import { Ticker } from '@/runtime/ticker';

const props = defineProps<{
  /** 组件类型 id：calendar / date / lunar / weather / text */
  type: string;
  /** 样式 id */
  style: string;
  /** 主题：midnight（深色）/ paper（浅色） */
  theme: 'midnight' | 'paper';
}>();

const widgetComponent = computed<Component>(() => {
  void widgetsVersion.value; // 依赖注册表变更计数：运行时安装 / 卸载样式后即时刷新
  return getWidget(props.type, props.style).component;
});
const theme = computed(() => getTheme(props.theme));

/** 各类型样例 options（让预览展示出最典型的形态） */
const SAMPLE_OPTIONS: Record<string, Record<string, unknown>> = {
  calendar: { week_start: 1, show_week_number: true, format: 'M月D日 dddd' },
  date: { format: 'YYYY年MM月DD日 dddd' },
  lunar: { format: '{lunar_month}{lunar_day} {ganzhi}' },
  weather: { entity: 'weather.home' },
  text: { content: '室内 {sensor.temperature}°C' },
};
const options = computed<Record<string, unknown>>(() => SAMPLE_OPTIONS[props.type] ?? {});

/** mock hass：提供 weather.home 与 sensor.temperature 供预览读取 */
const mockHass: HassLike = {
  states: {
    'weather.home': {
      entity_id: 'weather.home',
      state: 'sunny',
      attributes: { temperature: 23, humidity: 45 },
      last_changed: '',
      last_updated: '',
    },
    'sensor.temperature': {
      entity_id: 'sensor.temperature',
      state: '23.5',
      attributes: {},
      last_changed: '',
      last_updated: '',
    },
  },
};

/** 背景近似屏保主题底色（midnight → #0b1020，paper → #f5f1e8） */
const backdropStyle = computed(() => ({
  background: props.theme === 'paper' ? '#f5f1e8' : '#0b1020',
}));

/** 主题 CSS 变量（与屏保根组件一致，供组件取色） */
const themeVars = computed(() => ({
  '--snooze-text': theme.value.text,
  '--snooze-text-secondary': theme.value.textSecondary,
  '--snooze-accent': theme.value.accent,
  fontFamily: theme.value.fontFamily,
  color: theme.value.text,
}));

const now = ref(new Date());
let ticker: Ticker | null = null;

onMounted(() => {
  ticker = new Ticker(() => {
    now.value = new Date();
  });
  ticker.watchVisibility();
  ticker.start();
});

onBeforeUnmount(() => {
  if (ticker) {
    ticker.destroy();
    ticker = null;
  }
});
</script>

<template>
  <div class="widget-preview">
    <div class="backdrop" :style="backdropStyle"></div>
    <div class="stage" :style="themeVars">
      <component
        :is="widgetComponent"
        :now="now"
        :hass="mockHass"
        :theme="theme"
        :options="options"
      />
    </div>
  </div>
</template>

<style scoped>
.widget-preview {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  /* 预览纯展示，不拦截宿主交互（卡片点击等） */
  pointer-events: none;
}
.backdrop {
  position: absolute;
  inset: 0;
}
.stage {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 6%;
  /* 尺寸容器：内容组件的 cqw/clamp 在此解析 */
  container-type: size;
}
</style>
