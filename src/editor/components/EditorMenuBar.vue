<script setup lang="ts">
/**
 * 编辑器五区之一：插件菜单栏（顶，可收起）。
 *
 * 品牌 + 全局配置菜单浮层（基础 / 外观 / 条件 / 设备 / 高级，单一 Popover 复用内容）
 * + 启用屏保开关 + 保存到后端 + 收起；收起态退化为细条。
 * 菜单导航与外层 Popover 状态内聚于此；草稿（draft）经 provide/inject 获取，
 * 保存态由 props 传入，保存动作用 emit 回传，由 EditorApp 统一落盘到 HA 后端。
 */
import { computed, nextTick, ref } from 'vue';
import type { HassLike } from '@/core/hass';
import { injectEditorDraft } from '../editorContext';
import Button from 'primevue/button';
import ToggleSwitch from 'primevue/toggleswitch';
import Popover from 'primevue/popover';
import BasicPanel from '../panels/BasicPanel.vue';
import AppearancePanel from '../panels/AppearancePanel.vue';
import ConditionsPanel from '../panels/ConditionsPanel.vue';
import DevicePanel from '../panels/DevicePanel.vue';
import AdvancedPanel from '../panels/AdvancedPanel.vue';

defineProps<{
  /** 是否收起（细条态） */
  collapsed: boolean;
  /** HA hass（供条件面板筛实体；可为空） */
  hass: HassLike | null;
  /** 当前设备 id（设备面板展示） */
  deviceId: string;
  /** 是否正在保存到后端 */
  deviceSaving: boolean;
  /** 保存反馈文案 */
  deviceSaved: string;
}>();

// 编辑草稿经 provide/inject 下发：共享 reactive，子组件就地写回，避免逐字段 emit 与修改 prop
const draft = injectEditorDraft();

const emit = defineEmits<{
  (e: 'toggle-collapse'): void;
  (e: 'save'): void;
}>();

type MenuKey = 'basic' | 'appearance' | 'conditions' | 'device' | 'advanced';

const MENUS: { key: MenuKey; label: string }[] = [
  { key: 'basic', label: '基础' },
  { key: 'appearance', label: '外观' },
  { key: 'conditions', label: '条件' },
  { key: 'device', label: '设备' },
  { key: 'advanced', label: '高级' },
];

/** 当前展开的菜单（null 表示全部收起） */
const openMenu = ref<MenuKey | null>(null);
/** 单一 Popover 实例：内容随 openMenu 切换，故只需一个锚定浮层 */
const menuPopover = ref();
const openMenuLabel = computed(() => MENUS.find((m) => m.key === openMenu.value)?.label ?? '');

/** 打开 / 切换某组菜单浮层（重复点击同一项即关闭） */
function toggleMenuPanel(key: MenuKey, ev: MouseEvent): void {
  if (openMenu.value === key) {
    menuPopover.value?.hide();
    openMenu.value = null;
    return;
  }
  openMenu.value = key;
  // 等浮层内容切换完成后再定位，保证按新内容尺寸对齐按钮
  void nextTick(() => menuPopover.value?.show(ev));
}

function onMenuHide(): void {
  openMenu.value = null;
}

function onToggleCollapse(): void {
  emit('toggle-collapse');
}

function onSave(): void {
  emit('save');
}
</script>

<template>
  <header class="plugin-menu" :class="{ collapsed }">
    <template v-if="!collapsed">
      <div class="menu-brand">
        <span class="menu-brand-name">SnoozePanel</span>
        <span class="menu-brand-sub">屏保配置</span>
      </div>
      <nav class="menu-nav">
        <Button
          v-for="m in MENUS"
          :key="m.key"
          :label="m.label"
          size="small"
          text
          :class="{ active: openMenu === m.key }"
          @click="toggleMenuPanel(m.key, $event)"
        />
      </nav>
      <div class="menu-actions">
        <label class="menu-switch">
          <ToggleSwitch v-model="draft.enabled" />
          <span>启用屏保</span>
        </label>
        <Button
          :loading="deviceSaving"
          label="保存到后端"
          icon="pi pi-cloud-upload"
          size="small"
          @click="onSave"
        />
        <Button
          icon="pi pi-angle-up"
          size="small"
          text
          title="收起菜单栏"
          aria-label="收起菜单栏"
          @click="onToggleCollapse"
        />
      </div>
    </template>

    <!-- 收起态：细条（品牌 + 启用状态 + 展开按钮） -->
    <template v-else>
      <div class="menu-brand slim">
        <span class="menu-brand-name">SnoozePanel</span>
        <span class="menu-state">{{ draft.enabled ? '已启用' : '已停用' }}</span>
      </div>
      <Button
        icon="pi pi-angle-down"
        label="展开菜单栏"
        size="small"
        text
        title="展开菜单栏"
        @click="onToggleCollapse"
      />
    </template>

    <!-- 全局配置菜单浮层（单一 Popover，内容随 openMenu 切换） -->
    <Popover ref="menuPopover" @hide="onMenuHide">
      <div class="menu-panel">
        <div class="menu-panel-title">{{ openMenuLabel }}</div>
        <BasicPanel
          v-if="openMenu === 'basic'"
          v-model:idle-seconds="draft.idle_seconds"
          v-model:exit-cooldown="draft.exit_cooldown_seconds"
          v-model:screensaver-entity="draft.screensaver_entity"
        />
        <AppearancePanel
          v-else-if="openMenu === 'appearance'"
          v-model:theme="draft.theme"
          v-model:background="draft.background"
        />
        <ConditionsPanel
          v-else-if="openMenu === 'conditions'"
          v-model:conditions="draft.conditions"
          :hass="hass"
        />
        <DevicePanel
          v-else-if="openMenu === 'device'"
          v-model:devices="draft.devices"
          :device-id="deviceId"
          :saving="deviceSaving"
          :saved="deviceSaved"
          @save="onSave"
        />
        <AdvancedPanel
          v-else-if="openMenu === 'advanced'"
          v-model:display-template="draft.display_template"
          v-model:component-templates="draft.component_templates"
        />
      </div>
    </Popover>
  </header>
</template>

<style scoped>
/* ============ 1. 插件菜单栏（顶） ============ */
.plugin-menu {
  display: flex;
  align-items: center;
  gap: 16px;
  flex: none;
  height: 52px;
  padding: 0 12px;
  border-bottom: 1px solid var(--sp-chrome-border, #494e52);
  background: var(--sp-chrome-bg, #33373a);
}
.plugin-menu.collapsed {
  height: 40px;
}
.menu-brand {
  display: flex;
  flex-direction: column;
  line-height: 1.15;
  flex: none;
}
.menu-brand-name {
  font-weight: 700;
  font-size: 14px;
}
.menu-brand-sub {
  font-size: 11px;
  color: var(--sp-chrome-text-dim, #98a0a6);
}
.menu-brand.slim {
  flex-direction: row;
  align-items: baseline;
  gap: 8px;
}
.menu-state {
  font-size: 12px;
  color: var(--sp-chrome-text-dim, #98a0a6);
}
.menu-nav {
  display: flex;
  align-items: center;
  gap: 2px;
  flex: 1;
  min-width: 0;
  overflow-x: auto;
}
.menu-nav :deep(.p-button.active) {
  background: var(--primary-color, #5ea0ff);
  color: #fff;
}
.menu-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: none;
  margin-left: auto;
}
.menu-switch {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  white-space: nowrap;
}

/* 全局配置菜单浮层 */
.menu-panel {
  width: 320px;
  max-height: min(70vh, 560px);
  overflow-y: auto;
}
.menu-panel-title {
  font-weight: 700;
  font-size: 13px;
  margin-bottom: 12px;
  color: var(--primary-color, #5ea0ff);
}
</style>
