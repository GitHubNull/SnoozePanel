<script setup lang="ts">
/**
 * 编辑器顶部工具条：位于菜单栏与工作区之间，提供「对齐」与「图层」两个下拉菜单。
 *
 * 动作经 provide/inject 获取（EditorApp 提供的 EditorActionsKey）；选中数量经选中态上下文读取，
 * 用于控制菜单项禁用态（对齐需 ≥2、分布需 ≥3；图层需有主选中）。
 * 菜单采用 PrimeVue Menu 的 popup 模式，item 插槽自定义「图标 + 中文 + 快捷键」布局。
 */
import { computed, ref } from 'vue';
import Button from 'primevue/button';
import Menu from 'primevue/menu';
import type { MenuItem } from 'primevue/menuitem';
import { injectEditorActions, injectEditorSelection } from '../editorContext';
import type { DistributeAxis } from '@/core/align';
import type { LayerOp } from '@/core/layers';

/** 带快捷键提示的菜单项 */
interface TbItem extends MenuItem {
  shortcut?: string;
}

const selection = injectEditorSelection();
const actions = injectEditorActions();

const canAlign = actions.alignment.canAlign;
const canDistribute = actions.alignment.canDistribute;
const hasSelection = computed(() => selection.selectedCount.value > 0);

const alignMenu = ref();
const layerMenu = ref();

/** 对齐 / 分布菜单项 */
const alignItems = computed<TbItem[]>(() => {
  const d = (label: string, shortcut: string, axis: DistributeAxis): TbItem => ({
    label,
    shortcut,
    disabled: !canDistribute.value,
    command: () => actions.alignment.distribute(axis),
  });
  return [
    { label: '左对齐', shortcut: 'Alt+L', icon: 'pi pi-align-left', disabled: !canAlign.value, command: () => actions.alignment.align('left') },
    { label: '水平居中', shortcut: 'Alt+C', icon: 'pi pi-align-center', disabled: !canAlign.value, command: () => actions.alignment.align('hcenter') },
    { label: '右对齐', shortcut: 'Alt+R', icon: 'pi pi-align-right', disabled: !canAlign.value, command: () => actions.alignment.align('right') },
    { label: '顶端对齐', shortcut: 'Alt+T', icon: 'pi pi-arrow-up', disabled: !canAlign.value, command: () => actions.alignment.align('top') },
    { label: '垂直居中', shortcut: 'Alt+M', icon: 'pi pi-arrows-v', disabled: !canAlign.value, command: () => actions.alignment.align('vcenter') },
    { label: '底端对齐', shortcut: 'Alt+B', icon: 'pi pi-arrow-down', disabled: !canAlign.value, command: () => actions.alignment.align('bottom') },
    { separator: true },
    d('水平平均分布', 'Alt+H', 'horizontal'),
    d('垂直平均分布', 'Alt+V', 'vertical'),
  ];
});

/** 图层菜单项 */
const layerItems = computed<TbItem[]>(() => {
  const mk = (label: string, shortcut: string, icon: string, op: LayerOp): TbItem => ({
    label,
    shortcut,
    icon,
    disabled: !hasSelection.value,
    command: () => actions.layers.applyLayer(op),
  });
  return [
    mk('置于顶层', 'Ctrl+]', 'pi pi-angle-double-up', 'front'),
    mk('置于底层', 'Ctrl+[', 'pi pi-angle-double-down', 'back'),
    mk('上移一层', 'Ctrl+Shift+]', 'pi pi-angle-up', 'forward'),
    mk('下移一层', 'Ctrl+Shift+[', 'pi pi-angle-down', 'backward'),
  ];
});

function toggleAlign(ev: MouseEvent): void {
  alignMenu.value?.toggle(ev);
}
function toggleLayer(ev: MouseEvent): void {
  layerMenu.value?.toggle(ev);
}
</script>

<template>
  <div class="plugin-topbar">
    <span class="tb-hint">已选 {{ selection.selectedCount.value }} 项</span>
    <Button label="对齐" icon="pi pi-align-center" size="small" text @click="toggleAlign" />
    <Button label="图层" icon="pi pi-clone" size="small" text @click="toggleLayer" />

    <!-- 对齐 / 分布弹出菜单 -->
    <Menu ref="alignMenu" :model="alignItems" popup>
      <template #item="{ item }">
        <span class="tb-item">
          <i :class="item.icon" class="tb-item-icon" aria-hidden="true"></i>
          <span class="tb-item-label">{{ item.label }}</span>
          <span class="tb-item-key">{{ item.shortcut }}</span>
        </span>
      </template>
    </Menu>

    <!-- 图层弹出菜单 -->
    <Menu ref="layerMenu" :model="layerItems" popup>
      <template #item="{ item }">
        <span class="tb-item">
          <i :class="item.icon" class="tb-item-icon" aria-hidden="true"></i>
          <span class="tb-item-label">{{ item.label }}</span>
          <span class="tb-item-key">{{ item.shortcut }}</span>
        </span>
      </template>
    </Menu>
  </div>
</template>

<style scoped>
.plugin-topbar {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: none;
  height: 40px;
  padding: 0 12px;
  border-bottom: 1px solid var(--sp-chrome-border, #494e52);
  background: var(--sp-chrome-bg-2, #3f4448);
}
.tb-hint {
  margin-right: 8px;
  font-size: 12px;
  color: var(--sp-chrome-text-dim, #98a0a6);
  white-space: nowrap;
}

/* 菜单项：图标 + 中文 + 右对齐快捷键 */
.tb-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-width: 180px;
}
.tb-item-icon {
  width: 14px;
  flex: none;
}
.tb-item-label {
  flex: 1;
}
.tb-item-key {
  color: var(--sp-chrome-text-dim, #98a0a6);
  font-size: 12px;
  letter-spacing: 0.02em;
}
</style>
