<script setup lang="ts">
/**
 * 市场卡片（表盘 / 内容组件样式共用）。
 *
 * 纯展示：预览由调用方经默认插槽注入（FacePreview / WidgetPreview），
 * 卡片只负责名称、简介、来源 / 版本徽标与「使用中」标记；点击进入详情页。
 */
import type { MarketEntry } from './types';

defineProps<{ entry: MarketEntry }>();

const emit = defineEmits<{ (e: 'open'): void }>();
</script>

<template>
  <button type="button" class="market-card" :class="{ active: entry.inUse }" @click="emit('open')">
    <div class="market-card-preview">
      <slot name="preview" />
    </div>
    <div class="market-card-body">
      <span class="market-card-name">{{ entry.label }}</span>
      <p v-if="entry.summary" class="market-card-summary">{{ entry.summary }}</p>
      <div class="market-card-badges">
        <span v-if="entry.kindLabel" class="badge kind">{{ entry.kindLabel }}</span>
        <span class="badge source" :class="entry.source">
          {{ entry.source === 'builtin' ? '系统内置' : '第三方' }}
        </span>
        <span v-if="entry.version" class="badge ver">v{{ entry.version }}</span>
      </div>
      <span v-if="entry.author" class="market-card-author">作者：{{ entry.author }}</span>
    </div>
    <span v-if="entry.inUse" class="in-use">使用中</span>
  </button>
</template>

<style scoped>
.market-card {
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
.market-card:hover {
  transform: translateY(-3px);
  border-color: var(--primary-color, #5ea0ff);
  box-shadow: 0 8px 24px rgba(94, 160, 255, 0.18);
}
.market-card.active {
  border-color: var(--primary-color, #5ea0ff);
  box-shadow: 0 0 0 3px rgba(94, 160, 255, 0.25);
}
.market-card-preview {
  width: 100%;
  aspect-ratio: 16 / 10;
  background: #000;
  overflow: hidden;
}
.market-card-body {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px 14px;
}
.market-card-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--sp-chrome-text, #d8dcdf);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.market-card-summary {
  margin: 0;
  font-size: 12px;
  line-height: 1.4;
  color: var(--sp-chrome-text-dim, #98a0a6);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.market-card-badges {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.market-card-author {
  font-size: 11px;
  color: var(--sp-chrome-text-dim, #98a0a6);
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
.badge.ver {
  color: var(--sp-chrome-text-dim, #98a0a6);
  background: rgba(152, 160, 166, 0.14);
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
</style>
