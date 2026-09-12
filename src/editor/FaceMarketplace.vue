<script setup lang="ts">
/**
 * 表盘市场：沉浸式全屏模态，参考华为表盘市场设计语言。
 *
 * 特性：
 *   - 深色背景 + 大卡片网格（MarketCard）+ 实时预览（FacePreview）
 *   - 顶部 Tab：全部 / 系统内置 / 第三方；顶部「安装插件」入口
 *   - 点击卡片进入详情页（MarketDetail）：大预览 + 作者 / 版本 / 简介 / 详情 / 使用指南
 *   - 第三方已安装项可启用 / 停用 / 卸载；运行时注册表变更经 facesVersion 响应式刷新
 */
import { computed, ref } from 'vue';
import { facesVersion, listFaceOptions, type FaceOption } from '@/ui/faces/registry';
import FacePreview from '@/ui/components/FacePreview.vue';
import MarketCard from './market/MarketCard.vue';
import MarketDetail from './market/MarketDetail.vue';
import PluginInstallDialog from './PluginInstallDialog.vue';
import { usePluginInstall } from './market/usePluginInstall';
import type { MarketEntry } from './market/types';
import type { HassLike } from '@/core/hass';
import Dialog from 'primevue/dialog';
import Tabs from 'primevue/tabs';
import TabList from 'primevue/tablist';
import Tab from 'primevue/tab';
import TabPanels from 'primevue/tabpanels';
import TabPanel from 'primevue/tabpanel';
import Button from 'primevue/button';

const props = defineProps<{
  /** 当前选中表盘 id */
  modelValue: string;
  /** 主题（预览配色） */
  theme: 'midnight' | 'paper';
  /** 是否显示秒（预览动效） */
  seconds?: boolean;
  /** 是否 24 小时制 */
  hour24?: boolean;
  /** hass（第三方插件安装 / 卸载用） */
  hass: HassLike | null;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', faceId: string): void;
  (e: 'close'): void;
}>();

const visible = ref(true);
const activeTab = ref<'all' | 'builtin' | 'thirdparty'>('all');
/** 当前详情页表盘 key（空为列表视图） */
const detailKey = ref('');

const install = usePluginInstall(() => props.hass);
void install.refresh();

/** 表盘选项 → 统一市场条目 */
function toEntry(f: FaceOption): MarketEntry {
  const inst = install.installed.value.find((p) => p.id === f.id);
  return {
    key: f.id,
    value: f.id,
    label: f.label,
    source: f.source,
    kindLabel: f.kind === 'analog' ? '模拟' : '数字',
    inUse: f.id === props.modelValue,
    summary: f.summary,
    author: f.author,
    version: f.version,
    description: f.description,
    usage: f.usage,
    homepage: f.homepage,
    license: f.license,
    installed: f.source === 'thirdparty' ? f.installed ?? Boolean(inst) : false,
    enabled: inst?.enabled,
  };
}

/** 全部表盘条目（依赖 facesVersion 以响应运行时增删） */
const allFaces = computed<MarketEntry[]>(() => {
  void facesVersion.value;
  return listFaceOptions().map(toEntry);
});

const builtinFaces = computed(() => allFaces.value.filter((f) => f.source === 'builtin'));
const thirdpartyFaces = computed(() => allFaces.value.filter((f) => f.source === 'thirdparty'));
const detailEntry = computed(() => allFaces.value.find((f) => f.key === detailKey.value) ?? null);

function openDetail(entry: MarketEntry): void {
  detailKey.value = entry.key;
}
function backToList(): void {
  detailKey.value = '';
}

function useFace(entry: MarketEntry): void {
  emit('update:modelValue', entry.value);
  setTimeout(() => {
    visible.value = false;
    emit('close');
  }, 180);
}

async function onUninstall(entry: MarketEntry): Promise<void> {
  await install.uninstallEntry(entry);
  detailKey.value = '';
}
async function onSetEnabled(entry: MarketEntry, enabled: boolean): Promise<void> {
  await install.setEntryEnabled(entry, enabled);
}

function onHide(): void {
  emit('close');
}
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    :header="detailEntry ? '表盘详情' : '选择表盘'"
    :style="{ width: '92vw', maxWidth: '860px' }"
    :content-style="{ padding: '0' }"
    class="face-marketplace"
    @hide="onHide"
  >
    <!-- 详情视图 -->
    <MarketDetail
      v-if="detailEntry"
      :entry="detailEntry"
      use-label="使用此表盘"
      @back="backToList"
      @use="useFace(detailEntry)"
      @uninstall="onUninstall(detailEntry)"
      @set-enabled="onSetEnabled(detailEntry, $event)"
    >
      <template #preview>
        <FacePreview
          :face-id="detailEntry.key"
          :theme="theme"
          :seconds="seconds ?? true"
          :hour24="hour24 ?? true"
          :zoom="2"
        />
      </template>
    </MarketDetail>

    <!-- 列表视图 -->
    <template v-else>
      <div class="market-toolbar">
        <Button label="安装插件" icon="pi pi-plus" size="small" text @click="install.openInstall()" />
      </div>
      <Tabs v-model:value="activeTab" class="market-tabs">
        <TabList>
          <Tab value="all">全部（{{ allFaces.length }}）</Tab>
          <Tab value="builtin">系统内置（{{ builtinFaces.length }}）</Tab>
          <Tab value="thirdparty">第三方（{{ thirdpartyFaces.length }}）</Tab>
        </TabList>
        <TabPanels>
          <TabPanel value="all">
            <div class="face-grid">
              <MarketCard v-for="face in allFaces" :key="face.key" :entry="face" @open="openDetail(face)">
                <template #preview>
                  <FacePreview
                    :face-id="face.key"
                    :theme="theme"
                    :seconds="seconds ?? true"
                    :hour24="hour24 ?? true"
                    :zoom="1.4"
                  />
                </template>
              </MarketCard>
            </div>
          </TabPanel>
          <TabPanel value="builtin">
            <div class="face-grid">
              <MarketCard v-for="face in builtinFaces" :key="face.key" :entry="face" @open="openDetail(face)">
                <template #preview>
                  <FacePreview
                    :face-id="face.key"
                    :theme="theme"
                    :seconds="seconds ?? true"
                    :hour24="hour24 ?? true"
                    :zoom="1.4"
                  />
                </template>
              </MarketCard>
            </div>
          </TabPanel>
          <TabPanel value="thirdparty">
            <div v-if="thirdpartyFaces.length === 0" class="empty-tip">
              <p>暂无第三方表盘</p>
              <p class="sub">点击上方「安装插件」，从 HA 本地目录或上传插件包安装</p>
            </div>
            <div v-else class="face-grid">
              <MarketCard v-for="face in thirdpartyFaces" :key="face.key" :entry="face" @open="openDetail(face)">
                <template #preview>
                  <FacePreview
                    :face-id="face.key"
                    :theme="theme"
                    :seconds="seconds ?? true"
                    :hour24="hour24 ?? true"
                    :zoom="1.4"
                  />
                </template>
              </MarketCard>
            </div>
          </TabPanel>
        </TabPanels>
      </Tabs>
    </template>

    <!-- 安装弹窗 -->
    <PluginInstallDialog
      v-if="install.installVisible.value"
      :hass="hass"
      @close="install.closeInstall()"
      @installed="install.refresh()"
    />
  </Dialog>
</template>

<style scoped>
.market-toolbar {
  display: flex;
  justify-content: flex-end;
  padding: 10px 16px 0;
}
.face-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 16px;
  padding: 20px;
  max-height: 60vh;
  overflow-y: auto;
}
.empty-tip {
  padding: 48px 24px;
  text-align: center;
  color: var(--secondary-text-color, #8b95a8);
}
.empty-tip p {
  margin: 0 0 8px;
  font-size: 15px;
}
.empty-tip .sub {
  font-size: 13px;
  opacity: 0.75;
}
</style>

<!-- 表盘市场全局样式（Dialog Teleport 到 body，scoped 不生效） -->
<style>
.face-marketplace .p-dialog-content {
  background: var(--card-background-color, #10141d);
}
.face-marketplace .p-tablist {
  background: var(--card-background-color, #10141d);
  border-bottom: 1px solid var(--divider-color, #2a3346);
}
/* 确保 Dialog 在视口内固定定位，不随页面滚动 */
.p-dialog-mask {
  position: fixed !important;
  top: 0 !important;
  left: 0 !important;
  width: 100vw !important;
  height: 100vh !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  z-index: 99998 !important;
}
.p-dialog-mask .p-dialog {
  position: relative !important;
  margin: 0 !important;
  max-height: 90vh !important;
  z-index: 99999 !important;
}
</style>
