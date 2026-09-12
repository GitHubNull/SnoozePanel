<script setup lang="ts">
/**
 * 内容组件样式选择器：按类型列出全部样式并以缩略预览挑选。
 *
 * 参照 FaceMarketplace 的表盘市场设计语言：
 *   - 顶部 Tab：全部 / 系统内置 / 第三方
 *   - 卡片用 WidgetPreview 实时预览；当前选中样式高亮 + 「使用中」标签
 *   - 点击卡片 emit update:modelValue(style) 后延迟 180ms 关闭（选中动画可见）
 */
import { computed, ref } from 'vue';
import { listWidgetStyleOptions, WIDGET_TYPE_LABELS } from '@/ui/widgets/registry';
import WidgetPreview from '@/ui/components/WidgetPreview.vue';
import Dialog from 'primevue/dialog';
import Tabs from 'primevue/tabs';
import TabList from 'primevue/tablist';
import Tab from 'primevue/tab';
import TabPanels from 'primevue/tabpanels';
import TabPanel from 'primevue/tabpanel';

const props = defineProps<{
  /** 内容组件类型 id：calendar / date / lunar / weather / text */
  type: string;
  /** 当前选中样式 id */
  modelValue: string;
  /** 主题（预览配色） */
  theme: 'midnight' | 'paper';
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', style: string): void;
  (e: 'close'): void;
}>();

const visible = ref(true);

const allStyles = listWidgetStyleOptions(props.type);
const builtinStyles = computed(() => allStyles.filter((s) => s.source === 'builtin'));
const thirdpartyStyles = computed(() => allStyles.filter((s) => s.source === 'thirdparty'));

/** 弹窗标题：选择{类型中文名}样式 */
const dialogTitle = computed(() => `选择${WIDGET_TYPE_LABELS[props.type] ?? props.type}样式`);

function sourceLabel(source: 'builtin' | 'thirdparty'): string {
  return source === 'builtin' ? '系统内置' : '第三方';
}

function selectStyle(style: string): void {
  emit('update:modelValue', style);
  // 延迟关闭让选中动画可见
  setTimeout(() => {
    visible.value = false;
    emit('close');
  }, 180);
}

function onHide(): void {
  emit('close');
}
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    :header="dialogTitle"
    :style="{ width: '92vw', maxWidth: '860px' }"
    :content-style="{ padding: '0' }"
    class="widget-marketplace"
    @hide="onHide"
  >
    <Tabs value="all" class="market-tabs">
      <TabList>
        <Tab value="all">全部（{{ allStyles.length }}）</Tab>
        <Tab value="builtin">系统内置（{{ builtinStyles.length }}）</Tab>
        <Tab value="thirdparty">第三方（{{ thirdpartyStyles.length }}）</Tab>
      </TabList>
      <TabPanels>
        <TabPanel value="all">
          <div class="widget-grid">
            <button
              v-for="s in allStyles"
              :key="s.style"
              type="button"
              class="widget-card"
              :class="{ active: s.style === modelValue }"
              @click="selectStyle(s.style)"
            >
              <div class="widget-preview-wrap">
                <WidgetPreview :type="type" :style="s.style" :theme="theme" />
              </div>
              <div class="widget-info">
                <span class="widget-name">{{ s.label }}</span>
                <span class="badge source" :class="s.source">{{ sourceLabel(s.source) }}</span>
              </div>
              <span v-if="s.style === modelValue" class="in-use">使用中</span>
            </button>
          </div>
        </TabPanel>
        <TabPanel value="builtin">
          <div class="widget-grid">
            <button
              v-for="s in builtinStyles"
              :key="s.style"
              type="button"
              class="widget-card"
              :class="{ active: s.style === modelValue }"
              @click="selectStyle(s.style)"
            >
              <div class="widget-preview-wrap">
                <WidgetPreview :type="type" :style="s.style" :theme="theme" />
              </div>
              <div class="widget-info">
                <span class="widget-name">{{ s.label }}</span>
                <span class="badge source builtin">系统内置</span>
              </div>
              <span v-if="s.style === modelValue" class="in-use">使用中</span>
            </button>
          </div>
        </TabPanel>
        <TabPanel value="thirdparty">
          <div v-if="thirdpartyStyles.length === 0" class="empty-tip">
            <p>暂无第三方样式</p>
            <p class="sub">
              将样式目录放入 <code>src/ui/widgets/thirdparty/&lt;type&gt;/&lt;style&gt;/</code> 后重新构建即可
            </p>
          </div>
          <div v-else class="widget-grid">
            <button
              v-for="s in thirdpartyStyles"
              :key="s.style"
              type="button"
              class="widget-card"
              :class="{ active: s.style === modelValue }"
              @click="selectStyle(s.style)"
            >
              <div class="widget-preview-wrap">
                <WidgetPreview :type="type" :style="s.style" :theme="theme" />
              </div>
              <div class="widget-info">
                <span class="widget-name">{{ s.label }}</span>
                <span class="badge source thirdparty">第三方</span>
              </div>
              <span v-if="s.style === modelValue" class="in-use">使用中</span>
            </button>
          </div>
        </TabPanel>
      </TabPanels>
    </Tabs>
  </Dialog>
</template>

<style scoped>
.widget-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 16px;
  padding: 20px;
  max-height: 60vh;
  overflow-y: auto;
}

.widget-card {
  position: relative;
  display: flex;
  flex-direction: column;
  border: 2px solid var(--sp-chrome-border, #494e52);
  border-radius: 14px;
  background: var(--sp-chrome-bg-2, #3f4448);
  overflow: hidden;
  cursor: pointer;
  transition: transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
  text-align: left;
  padding: 0;
  font-family: inherit;
}

.widget-card:hover {
  transform: translateY(-3px);
  border-color: var(--primary-color, #5ea0ff);
  box-shadow: 0 8px 24px rgba(94, 160, 255, 0.18);
}

.widget-card.active {
  border-color: var(--primary-color, #5ea0ff);
  box-shadow: 0 0 0 3px rgba(94, 160, 255, 0.25);
}

.widget-preview-wrap {
  width: 100%;
  aspect-ratio: 16 / 10;
  background: #000;
  overflow: hidden;
}

.widget-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 12px 14px;
}

.widget-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--sp-chrome-text, #d8dcdf);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.badge {
  font-size: 11px;
  line-height: 1;
  padding: 4px 8px;
  border-radius: 999px;
  white-space: nowrap;
  flex: none;
}

.badge.source.builtin {
  color: #4fc07d;
  background: rgba(79, 192, 125, 0.14);
}

.badge.source.thirdparty {
  color: #e8b45a;
  background: rgba(232, 180, 90, 0.14);
}

.in-use {
  position: absolute;
  top: 10px;
  right: 10px;
  font-size: 11px;
  font-weight: 600;
  color: #fff;
  background: var(--primary-color, #5ea0ff);
  padding: 4px 10px;
  border-radius: 999px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
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

.empty-tip code {
  font-family: monospace;
  background: rgba(94, 160, 255, 0.12);
  color: var(--primary-color, #5ea0ff);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 12px;
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
