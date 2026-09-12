<script setup lang="ts">
/**
 * 表盘市场选择器：沉浸式全屏模态，参考华为表盘市场设计语言。
 *
 * 特性：
 *   - 深色背景 + 大卡片网格 + 实时预览（FacePreview）
 *   - 顶部 Tab：全部 / 系统内置 / 第三方
 *   - 当前选中表盘高亮边框 + 「使用中」标签
 *   - 点击卡片选中并关闭（带缩放过渡动画）
 */
import { computed, ref } from 'vue';
import { listFaceOptions } from '@/ui/faces/registry';
import FacePreview from '@/ui/components/FacePreview.vue';
import Dialog from 'primevue/dialog';
import Tabs from 'primevue/tabs';
import TabList from 'primevue/tablist';
import Tab from 'primevue/tab';
import TabPanels from 'primevue/tabpanels';
import TabPanel from 'primevue/tabpanel';

defineProps<{
  /** 当前选中表盘 id */
  modelValue: string;
  /** 主题（预览配色） */
  theme: 'midnight' | 'paper';
  /** 是否显示秒（预览动效） */
  seconds?: boolean;
  /** 是否 24 小时制 */
  hour24?: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', faceId: string): void;
  (e: 'close'): void;
}>();

const visible = ref(true);

const allFaces = listFaceOptions();

const builtinFaces = computed(() => allFaces.filter((f) => f.source === 'builtin'));
const thirdpartyFaces = computed(() => allFaces.filter((f) => f.source === 'thirdparty'));

function faceKindLabel(kind: 'digital' | 'analog'): string {
  return kind === 'analog' ? '模拟' : '数字';
}

function sourceLabel(source: 'builtin' | 'thirdparty'): string {
  return source === 'builtin' ? '系统内置' : '第三方';
}

function selectFace(faceId: string): void {
  emit('update:modelValue', faceId);
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
    header="选择表盘"
    :style="{ width: '92vw', maxWidth: '860px' }"
    :content-style="{ padding: '0' }"
    class="face-marketplace"
    @hide="onHide"
  >
    <Tabs value="all" class="market-tabs">
      <TabList>
        <Tab value="all">全部（{{ allFaces.length }}）</Tab>
        <Tab value="builtin">系统内置（{{ builtinFaces.length }}）</Tab>
        <Tab value="thirdparty">第三方（{{ thirdpartyFaces.length }}）</Tab>
      </TabList>
      <TabPanels>
        <TabPanel value="all">
          <div class="face-grid">
            <button
              v-for="face in allFaces"
              :key="face.id"
              type="button"
              class="face-card"
              :class="{ active: face.id === modelValue }"
              @click="selectFace(face.id)"
            >
              <div class="face-preview-wrap">
                <FacePreview
                  :face-id="face.id"
                  :theme="theme"
                  :seconds="seconds ?? true"
                  :hour24="hour24 ?? true"
                  :zoom="1.4"
                />
              </div>
              <div class="face-info">
                <span class="face-name">{{ face.label }}</span>
                <div class="face-badges">
                  <span class="badge kind">{{ faceKindLabel(face.kind) }}</span>
                  <span class="badge source" :class="face.source">{{ sourceLabel(face.source) }}</span>
                </div>
              </div>
              <span v-if="face.id === modelValue" class="in-use">使用中</span>
            </button>
          </div>
        </TabPanel>
        <TabPanel value="builtin">
          <div class="face-grid">
            <button
              v-for="face in builtinFaces"
              :key="face.id"
              type="button"
              class="face-card"
              :class="{ active: face.id === modelValue }"
              @click="selectFace(face.id)"
            >
              <div class="face-preview-wrap">
                <FacePreview
                  :face-id="face.id"
                  :theme="theme"
                  :seconds="seconds ?? true"
                  :hour24="hour24 ?? true"
                  :zoom="1.4"
                />
              </div>
              <div class="face-info">
                <span class="face-name">{{ face.label }}</span>
                <div class="face-badges">
                  <span class="badge kind">{{ faceKindLabel(face.kind) }}</span>
                  <span class="badge source builtin">系统内置</span>
                </div>
              </div>
              <span v-if="face.id === modelValue" class="in-use">使用中</span>
            </button>
          </div>
        </TabPanel>
        <TabPanel value="thirdparty">
          <div v-if="thirdpartyFaces.length === 0" class="empty-tip">
            <p>暂无第三方表盘</p>
            <p class="sub">将表盘目录放入 <code>src/ui/faces/thirdparty/&lt;id&gt;/</code> 后重新构建即可</p>
          </div>
          <div v-else class="face-grid">
            <button
              v-for="face in thirdpartyFaces"
              :key="face.id"
              type="button"
              class="face-card"
              :class="{ active: face.id === modelValue }"
              @click="selectFace(face.id)"
            >
              <div class="face-preview-wrap">
                <FacePreview
                  :face-id="face.id"
                  :theme="theme"
                  :seconds="seconds ?? true"
                  :hour24="hour24 ?? true"
                  :zoom="1.4"
                />
              </div>
              <div class="face-info">
                <span class="face-name">{{ face.label }}</span>
                <div class="face-badges">
                  <span class="badge kind">{{ faceKindLabel(face.kind) }}</span>
                  <span class="badge source thirdparty">第三方</span>
                </div>
              </div>
              <span v-if="face.id === modelValue" class="in-use">使用中</span>
            </button>
          </div>
        </TabPanel>
      </TabPanels>
    </Tabs>
  </Dialog>
</template>

<style scoped>
.face-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 16px;
  padding: 20px;
  max-height: 60vh;
  overflow-y: auto;
}

.face-card {
  position: relative;
  display: flex;
  flex-direction: column;
  border: 2px solid var(--divider-color, #2a3346);
  border-radius: 14px;
  background: var(--card-background-color, #151a23);
  overflow: hidden;
  cursor: pointer;
  transition: transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
  text-align: left;
  padding: 0;
  font-family: inherit;
}

.face-card:hover {
  transform: translateY(-3px);
  border-color: var(--primary-color, #5ea0ff);
  box-shadow: 0 8px 24px rgba(94, 160, 255, 0.18);
}

.face-card.active {
  border-color: var(--primary-color, #5ea0ff);
  box-shadow: 0 0 0 3px rgba(94, 160, 255, 0.25);
}

.face-preview-wrap {
  width: 100%;
  aspect-ratio: 16 / 10;
  background: #000;
  overflow: hidden;
}

.face-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 12px 14px;
}

.face-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-color, #e9edf5);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.face-badges {
  display: flex;
  gap: 6px;
  flex: none;
}

.badge {
  font-size: 11px;
  line-height: 1;
  padding: 4px 8px;
  border-radius: 999px;
  white-space: nowrap;
}

.badge.kind {
  color: var(--primary-color, #5ea0ff);
  background: rgba(94, 160, 255, 0.14);
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
