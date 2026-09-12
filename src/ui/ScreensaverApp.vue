<script setup lang="ts">
import { computed, ref, inject, onMounted, onBeforeUnmount } from 'vue';
import { baseWidthFor, type SnoozeConfig, type ComponentLayout } from '@/core/types';
import { getTheme } from './themes';
import { evalTemplate } from '@/core/template';
import type { HassLike } from '@/core/hass';
import { getFace } from './faces/registry';
import ComponentWrapper from './components/ComponentWrapper.vue';
import CalendarView from './components/CalendarView.vue';
import LunarView from './components/LunarView.vue';
import WeatherView from './components/WeatherView.vue';
import CustomText from './components/CustomText.vue';

interface SnoozeState {
  now: Date;
  hass: HassLike;
}

const props = withDefaults(
  defineProps<{
    config: SnoozeConfig;
    deviceId: string;
    /** 是否编辑态（相对定位铺满宿主，显示拖拽/缩放手柄，供编辑器预览画布用） */
    editMode?: boolean;
  }>(),
  {
    editMode: false,
  },
);

const emit = defineEmits<{
  (e: 'update:layout', compKey: string, layout: ComponentLayout): void;
}>();

// 响应式 now / hass 由 mount 层通过 provide 注入
const state = inject<SnoozeState>('snoozeState');
const now = computed(() => state?.now ?? new Date());
const hass = computed(() => state?.hass ?? ({ states: {} } as HassLike));

const theme = computed(() => getTheme(props.config.theme));

/**
 * 表盘生效主题：表盘内部将 theme.text / theme.textSecondary 以行内样式着色
 * （会覆盖 wrapper 的 color 继承），故这里把自定义字体颜色写回主题，
 * 使「字体颜色」对表盘（数字 / SVG 指针·刻度）同样生效；未设置时透传原主题。
 */
const clockTheme = computed(() => {
  const c = props.config.components.clock.color;
  if (!c) return theme.value;
  return { ...theme.value, text: c, textSecondary: c };
});

// 按表盘 id 动态解析入口组件（找不到回退默认表盘）
const faceComponent = computed(() => getFace(props.config.components.clock.style).component);

// ---- 背景轮播 ----
const bgIndex = ref(0);
let bgTimer: ReturnType<typeof setInterval> | null = null;

const bgImages = computed(() =>
  props.config.background.type === 'image' ? props.config.background.images : [],
);

onMounted(() => {
  if (bgImages.value.length > 1) {
    bgTimer = setInterval(() => {
      bgIndex.value = (bgIndex.value + 1) % bgImages.value.length;
    }, props.config.background.interval_seconds * 1000);
  }
});

onBeforeUnmount(() => {
  if (bgTimer !== null) clearInterval(bgTimer);
});

const backgroundStyle = computed(() => {
  const bg = props.config.background;
  if (bg.type === 'gradient') {
    return { background: `linear-gradient(${bg.gradient.angle}deg, ${bg.gradient.from}, ${bg.gradient.to})` };
  }
  if (bg.type === 'image' && bgImages.value.length > 0) {
    const url = bgImages.value[bgIndex.value % bgImages.value.length];
    return { backgroundImage: `url("${url}")`, backgroundSize: 'cover', backgroundPosition: 'center' };
  }
  return { background: bg.color };
});

// ---- 显隐模板 ----
const overallVisible = computed(() => evalTemplate(props.config.display_template, hass.value, true));

function compVisible(key: string, show: boolean): boolean {
  if (!show) return false;
  const tpl = props.config.component_templates[key];
  return evalTemplate(tpl, hass.value, true);
}

// ---- 组件清单（含布局与颜色） ----
interface PlacedComp {
  key: string;
  layout: ComponentLayout;
  color?: string;
}

const placedComponents = computed<PlacedComp[]>(() => {
  const c = props.config.components;
  const list: PlacedComp[] = [];
  if (compVisible('clock', c.clock.show)) {
    list.push({ key: 'clock', layout: c.clock.layout, color: c.clock.color });
  }
  if (compVisible('calendar', c.calendar.show)) {
    list.push({ key: 'calendar', layout: c.calendar.layout, color: c.calendar.color });
  }
  if (compVisible('lunar', c.lunar.show)) {
    list.push({ key: 'lunar', layout: c.lunar.layout, color: c.lunar.color });
  }
  if (compVisible('weather', c.weather.show && !!c.weather.entity)) {
    list.push({ key: 'weather', layout: c.weather.layout, color: c.weather.color });
  }
  c.texts.forEach((t, i) => {
    if (compVisible(`text_${i}`, true)) {
      list.push({ key: `text_${i}`, layout: t.layout, color: t.color });
    }
  });
  return list;
});

function onLayoutUpdate(compKey: string, layout: ComponentLayout): void {
  emit('update:layout', compKey, layout);
}

const themeVars = computed(() => ({
  '--snooze-text': theme.value.text,
  '--snooze-text-secondary': theme.value.textSecondary,
  '--snooze-accent': theme.value.accent,
  fontFamily: theme.value.fontFamily,
  color: theme.value.text,
}));
</script>

<template>
  <div v-if="overallVisible" class="snoozepanel" :class="{ 'edit-mode': editMode }" :style="[backgroundStyle, themeVars]">
    <div class="dim" :style="{ background: `rgba(0,0,0,${config.background.dim})` }"></div>

    <!-- 全部组件统一用 ComponentWrapper 渲染（自由布局 + 可选编辑态） -->
    <ComponentWrapper
      v-for="item in placedComponents"
      :key="item.key"
      :layout="item.layout"
      :color="item.color"
      :editable="editMode"
      :comp-key="item.key"
      :base-width="baseWidthFor(item.key)"
      @update:layout="onLayoutUpdate(item.key, $event)"
    >
      <component
        :is="faceComponent"
        v-if="item.key === 'clock'"
        :now="now"
        :hour24="config.components.clock.hour24"
        :seconds="config.components.clock.seconds"
        :theme="clockTheme"
      />
      <CalendarView
        v-else-if="item.key === 'calendar'"
        :now="now"
        :week-start="config.components.calendar.week_start"
        :show-week-number="config.components.calendar.show_week_number"
        :format="config.components.calendar.format"
      />
      <LunarView
        v-else-if="item.key === 'lunar'"
        :now="now" :format="config.components.lunar.format"
      />
      <WeatherView
        v-else-if="item.key === 'weather'"
        :hass="hass" :entity="config.components.weather.entity"
      />
      <CustomText
        v-else-if="item.key.startsWith('text_')"
        :hass="hass"
        :content="config.components.texts[Number(item.key.slice(5))].content"
      />
    </ComponentWrapper>

    <!-- 设备 id 角落标识 -->
    <div class="device-id">{{ deviceId }}</div>
  </div>
</template>

<style scoped>
.snoozepanel {
  position: fixed;
  inset: 0;
  z-index: 9999;
  overflow: hidden;
  transition: opacity 0.4s ease;
}
.snoozepanel.edit-mode {
  position: relative;
  inset: auto;
  z-index: auto;
  width: 100%;
  height: 100%;
}
.dim {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.device-id {
  position: absolute;
  right: 8px;
  bottom: 6px;
  font-size: 11px;
  opacity: 0.35;
  letter-spacing: 0.05em;
  user-select: text;
  z-index: 20;
}
</style>
