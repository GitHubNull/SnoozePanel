<script setup lang="ts">
import { computed, ref, inject, onMounted, onBeforeUnmount } from 'vue';
import type { SnoozeConfig, Position, GridPosition } from '@/core/types';
import { isAbsolutePosition } from '@/core/types';
import { getTheme } from './themes';
import { evalTemplate } from '@/core/template';
import type { HassLike } from '@/core/hass';
import { getFace } from './faces/registry';
import CalendarView from './components/CalendarView.vue';
import LunarView from './components/LunarView.vue';
import WeatherView from './components/WeatherView.vue';
import CustomText from './components/CustomText.vue';

interface SnoozeState {
  now: Date;
  hass: HassLike;
}

const props = defineProps<{
  config: SnoozeConfig;
  deviceId: string;
}>();

// 响应式 now / hass 由 mount 层通过 provide 注入
const state = inject<SnoozeState>('snoozeState');
const now = computed(() => state?.now ?? new Date());
const hass = computed(() => state?.hass ?? ({ states: {} } as HassLike));

const theme = computed(() => getTheme(props.config.theme));

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

// ---- 位置布局 ----
const GRID_AREAS: GridPosition[] = [
  'top_left', 'top_center', 'top_right',
  'center_left', 'center', 'center_right',
  'bottom_left', 'bottom_center', 'bottom_right',
];

interface Placed {
  key: string;
  position: Position;
}

const placedComponents = computed<Placed[]>(() => {
  const c = props.config.components;
  const list: Placed[] = [];
  if (compVisible('clock', c.clock.show)) list.push({ key: 'clock', position: c.clock.position });
  if (compVisible('calendar', c.calendar.show)) list.push({ key: 'calendar', position: c.calendar.position });
  if (compVisible('lunar', c.lunar.show)) list.push({ key: 'lunar', position: c.lunar.position });
  if (compVisible('weather', c.weather.show && !!c.weather.entity)) list.push({ key: 'weather', position: c.weather.position });
  c.texts.forEach((t, i) => {
    if (compVisible(`text_${i}`, true)) list.push({ key: `text_${i}`, position: t.position });
  });
  return list;
});

function gridItems(area: GridPosition): Placed[] {
  return placedComponents.value.filter((p) => p.position === area);
}

const absoluteItems = computed(() =>
  placedComponents.value.filter((p) => isAbsolutePosition(p.position)),
);

function absStyle(p: Position): Record<string, string> {
  if (isAbsolutePosition(p)) {
    return { left: `${p.x}%`, top: `${p.y}%`, transform: 'translate(-50%, -50%)' };
  }
  return {};
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
  <div v-if="overallVisible" class="snoozepanel" :style="[backgroundStyle, themeVars]">
    <div class="dim" :style="{ background: `rgba(0,0,0,${config.background.dim})` }"></div>

    <!-- 九宫格布局 -->
    <div class="grid">
      <div
        v-for="area in GRID_AREAS"
        :key="area"
        class="cell"
        :class="area"
      >
        <template v-for="item in gridItems(area)" :key="item.key">
          <component
            :is="faceComponent"
            v-if="item.key === 'clock'"
            :now="now"
            :hour24="config.components.clock.hour24"
            :seconds="config.components.clock.seconds"
            :theme="theme"
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
        </template>
      </div>
    </div>

    <!-- 绝对坐标组件 -->
    <div
      v-for="item in absoluteItems"
      :key="item.key"
      class="absolute-item"
      :style="absStyle(item.position)"
    >
      <component
        :is="faceComponent"
        v-if="item.key === 'clock'"
        :now="now"
        :hour24="config.components.clock.hour24"
        :seconds="config.components.clock.seconds"
        :theme="theme"
      />
      <CalendarView
        v-else-if="item.key === 'calendar'" :now="now"
        :week-start="config.components.calendar.week_start"
        :show-week-number="config.components.calendar.show_week_number"
        :format="config.components.calendar.format"
      />
      <LunarView v-else-if="item.key === 'lunar'" :now="now" :format="config.components.lunar.format" />
      <WeatherView v-else-if="item.key === 'weather'" :hass="hass" :entity="config.components.weather.entity" />
      <CustomText
        v-else-if="item.key.startsWith('text_')"
        :hass="hass" :content="config.components.texts[Number(item.key.slice(5))].content"
      />
    </div>

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
.dim {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.grid {
  position: absolute;
  inset: 0;
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  grid-template-rows: 1fr 1fr 1fr;
  padding: 4vmin;
  gap: 2vmin;
}
.cell {
  display: flex;
  flex-direction: column;
  gap: 1.2em;
  padding: 1vmin;
}
.top_left { align-items: flex-start; justify-content: flex-start; text-align: left; }
.top_center { align-items: center; justify-content: flex-start; text-align: center; }
.top_right { align-items: flex-end; justify-content: flex-start; text-align: right; }
.center_left { align-items: flex-start; justify-content: center; text-align: left; }
.center { align-items: center; justify-content: center; text-align: center; }
.center_right { align-items: flex-end; justify-content: center; text-align: right; }
.bottom_left { align-items: flex-start; justify-content: flex-end; text-align: left; }
.bottom_center { align-items: center; justify-content: flex-end; text-align: center; }
.bottom_right { align-items: flex-end; justify-content: flex-end; text-align: right; }

.absolute-item {
  position: absolute;
  z-index: 10;
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
