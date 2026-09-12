<script setup lang="ts">
import { reactive, watch, computed, ref, nextTick } from 'vue';
import type { SnoozeConfig, GridPosition } from '@/core/types';
import type { HassLike } from '@/core/hass';
import { listFaceOptions } from '@/ui/faces/registry';
import { saveDeviceConfig } from '@/core/store';
import { resolveDeviceId } from '@/core/device';
import FacePreview from '@/ui/components/FacePreview.vue';
import Toast from 'primevue/toast';
import { useToast } from 'primevue/usetoast';
import Tabs from 'primevue/tabs';
import TabList from 'primevue/tablist';
import Tab from 'primevue/tab';
import TabPanels from 'primevue/tabpanels';
import TabPanel from 'primevue/tabpanel';
import ToggleSwitch from 'primevue/toggleswitch';
import InputNumber from 'primevue/inputnumber';
import InputText from 'primevue/inputtext';
import Select from 'primevue/select';
import Slider from 'primevue/slider';
import Textarea from 'primevue/textarea';
import Chip from 'primevue/chip';
import Button from 'primevue/button';
import EntityConditionsForm from './forms/EntityConditionsForm.vue';
import TextsForm from './forms/TextsForm.vue';

const props = defineProps<{
  config: SnoozeConfig;
  hass: HassLike | null;
}>();

const emit = defineEmits<{
  (e: 'change', config: SnoozeConfig): void;
}>();

// 本地草稿，任何字段变更后整体 emit（深拷贝避免引用污染）
const draft = reactive<SnoozeConfig>(JSON.parse(JSON.stringify(props.config)) as SnoozeConfig);

/**
 * 回声防护：HA 侧把 config-changed 的结果回填给 setConfig 时，
 * props.config 变化 → 同步草稿 → 草稿深度 watcher 触发 → 若不拦截会再次 emit，
 * 形成 emit → setConfig → emit 的无限循环。
 * 同步期间置位标记，待草稿 watcher 本轮执行完毕（nextTick）后复位。
 */
let syncingFromProps = false;

watch(
  () => props.config,
  (next) => {
    syncingFromProps = true;
    Object.assign(draft, JSON.parse(JSON.stringify(next)) as SnoozeConfig);
    void nextTick(() => {
      syncingFromProps = false;
    });
  },
  { deep: true },
);

let emitTimer: ReturnType<typeof setTimeout> | null = null;
watch(
  draft,
  () => {
    // 仅 props 回填引起的同步不对外 emit
    if (syncingFromProps) return;
    // 防抖 300ms，避免输入过程中频繁触发 config-changed
    if (emitTimer !== null) clearTimeout(emitTimer);
    emitTimer = setTimeout(() => {
      emit('change', JSON.parse(JSON.stringify(draft)) as SnoozeConfig);
    }, 300);
  },
  { deep: true },
);

// ---- 选项 ----
const POSITIONS: { label: string; value: GridPosition }[] = [
  { label: '左上', value: 'top_left' },
  { label: '顶部居中', value: 'top_center' },
  { label: '右上', value: 'top_right' },
  { label: '左中', value: 'center_left' },
  { label: '正中', value: 'center' },
  { label: '右中', value: 'center_right' },
  { label: '左下', value: 'bottom_left' },
  { label: '底部居中', value: 'bottom_center' },
  { label: '右下', value: 'bottom_right' },
];

const THEMES = [
  { label: '深夜（深色）', value: 'midnight' },
  { label: '宣纸（浅色）', value: 'paper' },
];

// 表盘选项：从注册表动态生成（label 中文名，value 表盘 id，kind 种类），数字在前
const CLOCK_STYLES = listFaceOptions().map((f) => ({ label: f.label, value: f.id, kind: f.kind }));

/** 表盘 id → 中文名（下拉收起态展示） */
function faceLabel(id: string): string {
  return CLOCK_STYLES.find((f) => f.value === id)?.label ?? id;
}

/** 表盘种类中文文案 */
function faceKindLabel(kind: 'digital' | 'analog'): string {
  return kind === 'analog' ? '模拟' : '数字';
}

// ---- 保存反馈 Toast ----
const toast = useToast();

const BG_TYPES = [
  { label: '纯色', value: 'color' },
  { label: '渐变', value: 'gradient' },
  { label: '图片轮播', value: 'image' },
];

const DEVICE_MODES = [
  { label: '白名单（仅列表内设备启用）', value: 'whitelist' },
  { label: '黑名单（列表内设备禁用）', value: 'blacklist' },
];

const WEEKDAYS = [
  { label: '一', value: 'mon' },
  { label: '二', value: 'tue' },
  { label: '三', value: 'wed' },
  { label: '四', value: 'thu' },
  { label: '五', value: 'fri' },
  { label: '六', value: 'sat' },
  { label: '日', value: 'sun' },
];

// 设备名单（逗号/空格分隔输入）
const deviceListText = computed({
  get: () => (draft.devices?.list ?? []).join(', '),
  set: (v: string) => {
    const list = v.split(/[,，\s]+/).map((s) => s.trim()).filter(Boolean);
    draft.devices = draft.devices ?? { mode: 'whitelist', list: [] };
    draft.devices.list = list;
  },
});

const deviceModeEnabled = computed({
  get: () => draft.devices !== null,
  set: (on: boolean) => {
    draft.devices = on ? { mode: 'whitelist', list: [] } : null;
  },
});

// 图片列表文本（每行一个）
const imagesText = computed({
  get: () => draft.background.images.join('\n'),
  set: (v: string) => {
    draft.background.images = v.split('\n').map((s) => s.trim()).filter(Boolean);
  },
});

// ---- 设备级覆盖（后端持久化） ----
const deviceId = resolveDeviceId();
const deviceSaving = ref(false);
const deviceSaved = ref('');

/** 把当前草稿整体存为本设备的后端覆盖配置（含 Toast 反馈） */
async function onSaveDevice(): Promise<void> {
  if (!props.hass) {
    deviceSaved.value = '后端不可用';
    toast.add({
      severity: 'warn',
      summary: '后端不可用',
      detail: '当前环境未连接 Home Assistant，无法保存设备级配置。',
      life: 4000,
    });
    return;
  }
  deviceSaving.value = true;
  deviceSaved.value = '';
  try {
    const ok = await saveDeviceConfig(props.hass, deviceId, JSON.parse(JSON.stringify(draft)) as SnoozeConfig);
    deviceSaved.value = ok ? '已保存到后端' : '保存失败（后端不可用）';
    if (ok) {
      toast.add({
        severity: 'success',
        summary: '保存成功',
        detail: `配置已保存为本设备（${deviceId}）的独立覆盖。`,
        life: 3000,
      });
      setTimeout(() => { deviceSaved.value = ''; }, 3000);
    } else {
      toast.add({
        severity: 'error',
        summary: '保存失败',
        detail: '后端未接受本次写入，请检查连接后重试。',
        life: 5000,
      });
    }
  } catch (err) {
    deviceSaved.value = '保存异常';
    toast.add({
      severity: 'error',
      summary: '保存异常',
      detail: err instanceof Error ? err.message : String(err),
      life: 5000,
    });
  } finally {
    deviceSaving.value = false;
  }
}

// 时间段条件开关
const timeEnabled = computed({
  get: () => draft.conditions.time !== undefined,
  set: (on: boolean) => {
    draft.conditions.time = on ? { after: '21:00', before: '07:00' } : undefined;
  },
});

const sunEnabled = computed({
  get: () => draft.conditions.sun !== undefined,
  set: (on: boolean) => {
    draft.conditions.sun = on ? { after_sunset_offset: 0 } : undefined;
  },
});

// 天气实体候选（从 hass 中筛 weather.*）
const weatherEntities = computed(() => {
  if (!props.hass) return [];
  return Object.keys(props.hass.states).filter((id) => id.startsWith('weather.'));
});

// 星期多选
const weekdaySelection = computed<string[]>({
  get: () => (draft.conditions.time?.weekday ?? []) as string[],
  set: (v: string[]) => {
    if (draft.conditions.time) {
      draft.conditions.time.weekday = v as never;
    }
  },
});

function toggleWeekday(value: string): void {
  if (!draft.conditions.time) return;
  const list = [...((draft.conditions.time.weekday ?? []) as string[])];
  const idx = list.indexOf(value);
  if (idx >= 0) list.splice(idx, 1);
  else list.push(value);
  draft.conditions.time.weekday = list as never;
}

// 可空字符串字段的 v-model 适配（空串 → null）
const screensaverEntityModel = computed<string>({
  get: () => draft.screensaver_entity ?? '',
  set: (v: string) => { draft.screensaver_entity = v.trim() || null; },
});

const displayTemplateModel = computed<string>({
  get: () => draft.display_template ?? '',
  set: (v: string) => { draft.display_template = v.trim() || null; },
});

const componentTemplatesModel = computed<string>({
  get: () => (Object.keys(draft.component_templates).length ? JSON.stringify(draft.component_templates, null, 2) : ''),
  set: (v: string) => {
    try {
      draft.component_templates = v.trim() ? (JSON.parse(v) as Record<string, string>) : {};
    } catch {
      // JSON 未输入完整时保留旧值，不打断输入
    }
  },
});
</script>

<template>
  <div class="snooze-editor">
    <!-- 保存等操作反馈的 Toast 容器（底部右侧，自动消失） -->
    <Toast position="bottom-right" />

    <header class="editor-header">
      <h2>SnoozePanel 屏保设置</h2>
      <p class="hint">配置将写入当前视图的 <code>snoozepanel:</code> 段。未配置屏保的视图不受影响。</p>
    </header>

    <div class="field master-switch">
      <label>启用屏保</label>
      <ToggleSwitch v-model="draft.enabled" />
    </div>

    <Tabs value="basic">
      <TabList>
        <Tab value="basic">基础</Tab>
        <Tab value="devices">设备范围</Tab>
        <Tab value="conditions">生效条件</Tab>
        <Tab value="components">显示组件</Tab>
        <Tab value="background">背景</Tab>
        <Tab value="advanced">高级</Tab>
      </TabList>
      <TabPanels>
      <!-- ============ 基础 ============ -->
      <TabPanel value="basic">
        <div class="field">
          <label>闲置触发时长（秒）</label>
          <InputNumber v-model="draft.idle_seconds" :min="5" :max="3600" show-buttons />
          <small>无触摸/按键操作多少秒后进入屏保</small>
        </div>
        <div class="field">
          <label>退出冷却（秒）</label>
          <InputNumber v-model="draft.exit_cooldown_seconds" :min="0" :max="30" show-buttons />
          <small>进入屏保后短暂忽略触摸，防误触退出</small>
        </div>
        <div class="field">
          <label>主题</label>
          <Select v-model="draft.theme" :options="THEMES" option-label="label" option-value="value" class="w-full" />
        </div>
        <div class="field">
          <label>远程控制实体（input_boolean，可选）</label>
          <InputText v-model="screensaverEntityModel" placeholder="input_boolean.screensaver" class="w-full" />
          <small>置 on 强制进入屏保，触摸退出时自动复位为 off</small>
        </div>
      </TabPanel>

      <!-- ============ 设备范围 ============ -->
      <TabPanel value="devices">
        <div class="field">
          <label>按设备限制</label>
          <ToggleSwitch v-model="deviceModeEnabled" />
          <small>开启后仅指定设备生效/屏蔽。设备 id 显示在屏保右下角，或用 ?snooze_device=xxx 指定</small>
        </div>
        <template v-if="draft.devices">
          <div class="field">
            <label>名单模式</label>
            <Select v-model="draft.devices.mode" :options="DEVICE_MODES" option-label="label" option-value="value" class="w-full" />
          </div>
          <div class="field">
            <label>设备 id 列表（逗号分隔）</label>
            <Textarea v-model="deviceListText" rows="3" class="w-full" placeholder="dev-abc123, pad-kitchen" />
          </div>
        </template>
      </TabPanel>

      <!-- ============ 生效条件 ============ -->
      <TabPanel value="conditions">
        <p class="hint">以下条件为「与」关系，全部满足才会进入屏保；屏保中条件失效会立即退出。</p>

        <EntityConditionsForm v-model="draft.conditions.entity" :hass="hass" />

        <div class="field">
          <label>时间段限制</label>
          <ToggleSwitch v-model="timeEnabled" />
        </div>
        <template v-if="draft.conditions.time">
          <div class="field-row">
            <div class="field">
              <label>晚于（HH:mm）</label>
              <InputText v-model="draft.conditions.time.after" placeholder="21:00" class="w-full" />
            </div>
            <div class="field">
              <label>早于（HH:mm）</label>
              <InputText v-model="draft.conditions.time.before" placeholder="07:00" class="w-full" />
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

        <div class="field">
          <label>日出日落限制</label>
          <ToggleSwitch v-model="sunEnabled" />
        </div>
        <template v-if="draft.conditions.sun">
          <div class="field">
            <label>日落后偏移（分钟，可负）</label>
            <InputNumber v-model="draft.conditions.sun.after_sunset_offset" :min="-180" :max="720" show-buttons />
            <small>例如 30 表示日落后 30 分钟才允许进入屏保</small>
          </div>
          <div class="field">
            <label>日出前偏移（分钟）</label>
            <InputNumber v-model="draft.conditions.sun.before_sunrise_offset" :min="-180" :max="720" show-buttons />
          </div>
        </template>
      </TabPanel>

      <!-- ============ 显示组件 ============ -->
      <TabPanel value="components">
        <!-- 时钟 -->
        <fieldset>
          <legend><ToggleSwitch v-model="draft.components.clock.show" /> 时钟</legend>
          <template v-if="draft.components.clock.show">
            <div class="field-row">
              <div class="field">
                <label>表盘</label>
                <!-- 表盘下拉：选项/收起态均内嵌实时迷你预览（FacePreview 缩放舞台） -->
                <Select
                  v-model="draft.components.clock.style"
                  :options="CLOCK_STYLES"
                  option-label="label"
                  option-value="value"
                  panel-class="face-dropdown-panel"
                  scroll-height="460px"
                  class="w-full"
                >
                  <template #value="slotProps">
                    <div class="face-cell">
                      <FacePreview
                        class="face-thumb"
                        :face-id="String(slotProps.value ?? '')"
                        :theme="draft.theme"
                      />
                      <span class="face-cell-label">{{ faceLabel(String(slotProps.value ?? '')) }}</span>
                    </div>
                  </template>
                  <template #option="slotProps">
                    <div class="face-cell">
                      <FacePreview
                        class="face-thumb"
                        :face-id="slotProps.option.value"
                        :theme="draft.theme"
                      />
                      <span class="face-cell-label">{{ slotProps.option.label }}</span>
                      <span class="face-kind-badge">{{ faceKindLabel(slotProps.option.kind) }}</span>
                    </div>
                  </template>
                </Select>
              </div>
              <div class="field">
                <label>位置</label>
                <Select v-model="draft.components.clock.position" :options="POSITIONS" option-label="label" option-value="value" class="w-full" />
              </div>
            </div>
            <div class="field-row">
              <div class="field inline"><label>24 小时制</label><ToggleSwitch v-model="draft.components.clock.hour24" /></div>
              <div class="field inline"><label>显示秒</label><ToggleSwitch v-model="draft.components.clock.seconds" /></div>
            </div>
          </template>
        </fieldset>

        <!-- 日历 -->
        <fieldset>
          <legend><ToggleSwitch v-model="draft.components.calendar.show" /> 日历</legend>
          <template v-if="draft.components.calendar.show">
            <div class="field-row">
              <div class="field">
                <label>周起始日</label>
                <Select v-model="draft.components.calendar.week_start"
                  :options="[{label:'周一',value:1},{label:'周日',value:0}]"
                  option-label="label" option-value="value" class="w-full" />
              </div>
              <div class="field">
                <label>位置</label>
                <Select v-model="draft.components.calendar.position" :options="POSITIONS" option-label="label" option-value="value" class="w-full" />
              </div>
            </div>
            <div class="field">
              <label>日期格式模板</label>
              <InputText v-model="draft.components.calendar.format" class="w-full" placeholder="M月D日 dddd" />
              <small>占位符：YYYY 年 / M 月 / D 日 / dddd 星期</small>
            </div>
            <div class="field inline"><label>显示周数</label><ToggleSwitch v-model="draft.components.calendar.show_week_number" /></div>
          </template>
        </fieldset>

        <!-- 农历 -->
        <fieldset>
          <legend><ToggleSwitch v-model="draft.components.lunar.show" /> 农历</legend>
          <template v-if="draft.components.lunar.show">
            <div class="field">
              <label>格式模板</label>
              <InputText v-model="draft.components.lunar.format" class="w-full" placeholder="{lunar_month}{lunar_day}" />
              <small>占位符：{'{lunar_month}'} 月 / {'{lunar_day}'} 日 / {'{ganzhi}'} 干支 / {'{zodiac}'} 生肖</small>
            </div>
            <div class="field">
              <label>位置</label>
              <Select v-model="draft.components.lunar.position" :options="POSITIONS" option-label="label" option-value="value" class="w-full" />
            </div>
          </template>
        </fieldset>

        <!-- 天气 -->
        <fieldset>
          <legend><ToggleSwitch v-model="draft.components.weather.show" /> 天气</legend>
          <template v-if="draft.components.weather.show">
            <div class="field">
              <label>天气实体</label>
              <Select v-model="draft.components.weather.entity" :options="weatherEntities" editable class="w-full" placeholder="weather.home" />
            </div>
            <div class="field">
              <label>位置</label>
              <Select v-model="draft.components.weather.position" :options="POSITIONS" option-label="label" option-value="value" class="w-full" />
            </div>
          </template>
        </fieldset>

        <!-- 自定义文本 -->
        <fieldset>
          <legend>自定义文本</legend>
          <TextsForm v-model="draft.components.texts" :positions="POSITIONS" />
        </fieldset>

        <!-- 设备级覆盖（后端持久化） -->
        <fieldset>
          <legend>设备级覆盖</legend>
          <div class="field">
            <label>当前设备 id</label>
            <div class="device-id-text">{{ deviceId }}</div>
            <small>把当前配置存为该设备的独立覆盖，落盘到 HA 后端（断电/重启/清缓存不丢）</small>
          </div>
          <div class="field">
            <Button :loading="deviceSaving" label="保存为本设备配置" @click="onSaveDevice" />
            <span v-if="deviceSaved" class="save-hint">{{ deviceSaved }}</span>
          </div>
        </fieldset>
      </TabPanel>

      <!-- ============ 背景 ============ -->
      <TabPanel value="background">
        <div class="field">
          <label>背景类型</label>
          <Select v-model="draft.background.type" :options="BG_TYPES" option-label="label" option-value="value" class="w-full" />
        </div>
        <div v-if="draft.background.type === 'color'" class="field">
          <label>颜色</label>
          <InputText v-model="draft.background.color" class="w-full" placeholder="#0b1020" />
        </div>
        <template v-if="draft.background.type === 'gradient'">
          <div class="field-row">
            <div class="field"><label>起始色</label><InputText v-model="draft.background.gradient.from" class="w-full" /></div>
            <div class="field"><label>结束色</label><InputText v-model="draft.background.gradient.to" class="w-full" /></div>
          </div>
          <div class="field">
            <label>角度（{{ draft.background.gradient.angle }}°）</label>
            <Slider v-model="draft.background.gradient.angle" :min="0" :max="360" />
          </div>
        </template>
        <template v-if="draft.background.type === 'image'">
          <div class="field">
            <label>图片地址（每行一张，多张轮播）</label>
            <Textarea v-model="imagesText" rows="4" class="w-full" placeholder="/local/bg1.jpg&#10;/local/bg2.jpg" />
          </div>
          <div class="field">
            <label>轮播间隔（秒）</label>
            <InputNumber v-model="draft.background.interval_seconds" :min="3" :max="600" show-buttons />
          </div>
        </template>
        <div class="field">
          <label>暗化遮罩（{{ Math.round(draft.background.dim * 100) }}%）</label>
          <Slider v-model="draft.background.dim" :min="0" :max="1" :step="0.05" />
          <small>在背景上叠加一层黑色遮罩，提升文字可读性</small>
        </div>
      </TabPanel>

      <!-- ============ 高级 ============ -->
      <TabPanel value="advanced">
        <div class="field">
          <label>整体显隐表达式（display_template）</label>
          <Textarea v-model="displayTemplateModel" rows="3" class="w-full code"
            placeholder="states['binary_sensor.someone_home'].state === 'on'" />
          <small>
            JS 表达式，返回 true 显示 / false 隐藏。可用变量：hass、states、user。
            示例：<code>Number(states['sensor.lux'].state) &lt; 50</code>。表达式出错时默认显示。
          </small>
        </div>
        <div class="field">
          <label>单组件显隐表达式（JSON，可选）</label>
          <Textarea v-model="componentTemplatesModel" rows="4" class="w-full code"
            placeholder='{"clock": "user.is_admin", "weather": "true"}' />
          <small>键为组件名（clock/calendar/lunar/weather/text_0…），值为 JS 表达式。</small>
        </div>
      </TabPanel>
      </TabPanels>
    </Tabs>
  </div>
</template>

<style scoped>
.snooze-editor {
  padding: 8px 4px;
  max-width: 720px;
}
.editor-header h2 {
  margin: 0 0 4px;
  font-size: 20px;
}
.hint {
  color: var(--secondary-text-color, #888);
  font-size: 13px;
  margin: 0 0 12px;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 18px;
}
.field.inline {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
}
.field > label {
  font-weight: 600;
  font-size: 14px;
}
.field small {
  color: var(--secondary-text-color, #888);
  font-size: 12px;
}
.field-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
.master-switch {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  background: var(--card-background-color, #f5f5f5);
  border-radius: 8px;
  margin-bottom: 16px;
}
fieldset {
  border: 1px solid var(--divider-color, #e0e0e0);
  border-radius: 8px;
  padding: 12px 16px 4px;
  margin-bottom: 16px;
}
legend {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  padding: 0 6px;
}
.w-full { width: 100%; }
.code { font-family: monospace; font-size: 13px; }
.weekday-chips {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.weekday-chips :deep(.p-chip) {
  cursor: pointer;
  opacity: 0.45;
}
.weekday-chips :deep(.p-chip.active) {
  opacity: 1;
  background: var(--primary-color, #5ea0ff);
  color: #fff;
}
.device-id-text {
  font-family: monospace;
  font-size: 14px;
  padding: 6px 10px;
  background: var(--card-background-color, #f5f5f5);
  border-radius: 6px;
  user-select: text;
}
.save-hint {
  margin-left: 10px;
  font-size: 13px;
  color: var(--primary-color, #5ea0ff);
}

/* ---- 表盘下拉预览单元格（收起态 + 选项行共用） ---- */
.face-cell {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 56px;
  width: 100%;
}
.face-thumb {
  width: 96px;
  height: 54px;
  flex: none;
  border-radius: 6px;
  border: 1px solid var(--divider-color, #e0e0e0);
}
.face-cell-label {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.face-kind-badge {
  flex: none;
  font-size: 12px;
  line-height: 1;
  padding: 4px 8px;
  border-radius: 999px;
  color: var(--primary-color, #5ea0ff);
  background: color-mix(in srgb, var(--primary-color, #5ea0ff) 14%, transparent);
}
</style>

<!--
  表盘下拉浮层样式（非 scoped）：PrimeVue 浮层会 Teleport 到 body，
  父组件的 scoped 属性不会作用于浮层，需以 panelClass（face-dropdown-panel）定位。
  两个关键事实：
  1. PrimeVue v4 的 Dropdown 实际渲染为 Select 的 DOM——浮层/列表容器/选项的类名
     为 p-select-overlay / p-select-list-container / p-select-option（不存在 p-dropdown-*），
     选择器必须用 p-select-*；列表可视高度由组件 scrollHeight 属性控制（内联 max-height，
     默认 14rem 仅容约 3 行），模板中已设为 460px 以容纳全部 6 行选项（每行约 62px）。
  2. 类名必须全局唯一：dev 实测页的自定义下拉另有独立样式（position/left/right 等），
     曾因复用同名类导致浮层被拉伸为近全宽。
-->
<style>
.face-dropdown-panel .p-select-option {
  padding: 4px 10px;
}
</style>
