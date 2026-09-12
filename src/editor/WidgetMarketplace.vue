<script setup lang="ts">
/**
 * 内容组件样式市场：按类型列出全部样式，卡片预览挑选，点击进入详情。
 *
 * 参照表盘市场设计语言：
 *   - 顶部 Tab：全部 / 系统内置 / 第三方；顶部「安装插件」入口
 *   - 卡片用 WidgetPreview 实时预览，详情页展示作者 / 版本 / 简介 / 使用指南
 *   - 第三方已安装项可启用 / 停用 / 卸载；经 widgetsVersion 响应式刷新
 */
import { computed, ref } from 'vue';
import { listWidgetStyleOptions, WIDGET_TYPE_LABELS, widgetsVersion } from '@/ui/widgets/registry';
import type { WidgetStyleOption } from '@/ui/widgets/types';
import WidgetPreview from '@/ui/components/WidgetPreview.vue';
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
  /** 内容组件类型 id：calendar / date / lunar / weather / text */
  type: string;
  /** 当前选中样式 id */
  modelValue: string;
  /** 主题（预览配色） */
  theme: 'midnight' | 'paper';
  /** hass（第三方插件安装 / 卸载用） */
  hass: HassLike | null;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', style: string): void;
  (e: 'close'): void;
}>();

const visible = ref(true);
const activeTab = ref<'all' | 'builtin' | 'thirdparty'>('all');
const detailKey = ref('');

const install = usePluginInstall(() => props.hass);
void install.refresh();

/** 弹窗标题：选择{类型中文名}样式 */
const dialogTitle = computed(() => `选择${WIDGET_TYPE_LABELS[props.type] ?? props.type}样式`);

/** 样式选项 → 统一市场条目 */
function toEntry(s: WidgetStyleOption): MarketEntry {
  const key = `${s.type}/${s.style}`;
  const inst = install.installed.value.find((p) => `${p.type}/${p.style}` === key);
  return {
    key,
    value: s.style,
    label: s.label,
    source: s.source,
    kindLabel: WIDGET_TYPE_LABELS[s.type],
    type: s.type,
    style: s.style,
    inUse: s.style === props.modelValue,
    summary: s.summary,
    author: s.author,
    version: s.version,
    description: s.description,
    usage: s.usage,
    homepage: s.homepage,
    license: s.license,
    installed: s.source === 'thirdparty' ? s.installed ?? Boolean(inst) : false,
    enabled: inst?.enabled,
  };
}

/** 当前类型的全部样式条目（依赖 widgetsVersion 以响应运行时增删） */
const allStyles = computed<MarketEntry[]>(() => {
  void widgetsVersion.value;
  return listWidgetStyleOptions(props.type).map(toEntry);
});

const builtinStyles = computed(() => allStyles.value.filter((s) => s.source === 'builtin'));
const thirdpartyStyles = computed(() => allStyles.value.filter((s) => s.source === 'thirdparty'));
const detailEntry = computed(() => allStyles.value.find((s) => s.key === detailKey.value) ?? null);

function openDetail(entry: MarketEntry): void {
  detailKey.value = entry.key;
}
function backToList(): void {
  detailKey.value = '';
}

function selectStyle(entry: MarketEntry): void {
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
    :header="detailEntry ? '样式详情' : dialogTitle"
    :style="{ width: '92vw', maxWidth: '860px' }"
    :content-style="{ padding: '0' }"
    class="widget-marketplace"
    @hide="onHide"
  >
    <!-- 详情视图 -->
    <MarketDetail
      v-if="detailEntry"
      :entry="detailEntry"
      use-label="使用此样式"
      @back="backToList"
      @use="selectStyle(detailEntry)"
      @uninstall="onUninstall(detailEntry)"
      @set-enabled="onSetEnabled(detailEntry, $event)"
    >
      <template #preview>
        <WidgetPreview :type="detailEntry.type ?? type" :style="detailEntry.style ?? detailEntry.value" :theme="theme" />
      </template>
    </MarketDetail>

    <!-- 列表视图 -->
    <template v-else>
      <div class="market-toolbar">
        <Button label="安装插件" icon="pi pi-plus" size="small" text @click="install.openInstall()" />
      </div>
      <Tabs v-model:value="activeTab" class="market-tabs">
        <TabList>
          <Tab value="all">全部（{{ allStyles.length }}）</Tab>
          <Tab value="builtin">系统内置（{{ builtinStyles.length }}）</Tab>
          <Tab value="thirdparty">第三方（{{ thirdpartyStyles.length }}）</Tab>
        </TabList>
        <TabPanels>
          <TabPanel value="all">
            <div class="widget-grid">
              <MarketCard v-for="s in allStyles" :key="s.key" :entry="s" @open="openDetail(s)">
                <template #preview>
                  <WidgetPreview :type="type" :style="s.style ?? s.value" :theme="theme" />
                </template>
              </MarketCard>
            </div>
          </TabPanel>
          <TabPanel value="builtin">
            <div class="widget-grid">
              <MarketCard v-for="s in builtinStyles" :key="s.key" :entry="s" @open="openDetail(s)">
                <template #preview>
                  <WidgetPreview :type="type" :style="s.style ?? s.value" :theme="theme" />
                </template>
              </MarketCard>
            </div>
          </TabPanel>
          <TabPanel value="thirdparty">
            <div v-if="thirdpartyStyles.length === 0" class="empty-tip">
              <p>暂无第三方样式</p>
              <p class="sub">点击上方「安装插件」，从 HA 本地目录或上传插件包安装</p>
            </div>
            <div v-else class="widget-grid">
              <MarketCard v-for="s in thirdpartyStyles" :key="s.key" :entry="s" @open="openDetail(s)">
                <template #preview>
                  <WidgetPreview :type="type" :style="s.style ?? s.value" :theme="theme" />
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
.widget-grid {
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

<!-- 内容组件样式市场全局样式（Dialog Teleport 到 body，scoped 不生效） -->
<style>
.widget-marketplace .p-dialog-content {
  background: var(--card-background-color, #10141d);
}
.widget-marketplace .p-tablist {
  background: var(--card-background-color, #10141d);
  border-bottom: 1px solid var(--divider-color, #2a3346);
}
</style>
