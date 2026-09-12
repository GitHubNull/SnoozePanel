<script setup lang="ts">
/**
 * 市场详情页（表盘 / 内容组件样式共用）。
 *
 * 展示大预览（调用方插槽注入）+ 名称 / 作者 / 版本 / 来源 / 简介 / 详细介绍 /
 * 使用指南 / 主页与协议，并提供「使用」按钮；第三方已安装项额外提供启用 / 停用与卸载。
 */
import { computed } from 'vue';
import Button from 'primevue/button';
import type { MarketEntry } from './types';

const props = withDefaults(
  defineProps<{
    entry: MarketEntry;
    /** 「使用」按钮文案（表盘：使用此表盘；样式：使用此样式） */
    useLabel?: string;
  }>(),
  { useLabel: '使用' },
);

const emit = defineEmits<{
  (e: 'back'): void;
  (e: 'use'): void;
  (e: 'uninstall'): void;
  (e: 'set-enabled', enabled: boolean): void;
}>();

/** 是否为可管理的第三方安装项 */
const manageable = computed(() => props.entry.source === 'thirdparty' && props.entry.installed === true);
</script>

<template>
  <div class="market-detail">
    <div class="detail-head">
      <Button icon="pi pi-arrow-left" text rounded aria-label="返回" @click="emit('back')" />
      <span class="detail-title">{{ entry.label }}</span>
      <span v-if="entry.inUse" class="in-use">使用中</span>
    </div>

    <div class="detail-scroll">
      <div class="detail-preview">
        <slot name="preview" />
      </div>

      <div class="detail-meta">
        <span v-if="entry.kindLabel" class="badge kind">{{ entry.kindLabel }}</span>
        <span class="badge source" :class="entry.source">
          {{ entry.source === 'builtin' ? '系统内置' : '第三方' }}
        </span>
        <span v-if="entry.version" class="badge ver">v{{ entry.version }}</span>
      </div>

      <dl class="detail-fields">
        <div v-if="entry.author" class="row"><dt>作者</dt><dd>{{ entry.author }}</dd></div>
        <div v-if="entry.version" class="row"><dt>版本</dt><dd>{{ entry.version }}</dd></div>
        <div v-if="entry.license" class="row"><dt>协议</dt><dd>{{ entry.license }}</dd></div>
        <div v-if="entry.homepage" class="row"><dt>主页</dt><dd class="link">{{ entry.homepage }}</dd></div>
      </dl>

      <section class="detail-section">
        <h4>简介</h4>
        <p>{{ entry.summary || '暂无简介' }}</p>
      </section>

      <section class="detail-section">
        <h4>详细介绍</h4>
        <p class="pre-wrap">{{ entry.description || '暂无详细介绍' }}</p>
      </section>

      <section class="detail-section">
        <h4>使用指南</h4>
        <p class="pre-wrap">{{ entry.usage || '暂无使用指南' }}</p>
      </section>
    </div>

    <div class="detail-actions">
      <Button :label="useLabel" icon="pi pi-check" :disabled="entry.inUse" @click="emit('use')" />
      <template v-if="manageable">
        <Button
          :label="entry.enabled === false ? '启用' : '停用'"
          :icon="entry.enabled === false ? 'pi pi-play' : 'pi pi-pause'"
          severity="secondary"
          text
          @click="emit('set-enabled', entry.enabled === false)"
        />
        <Button label="卸载" icon="pi pi-trash" severity="danger" text @click="emit('uninstall')" />
      </template>
    </div>
  </div>
</template>

<style scoped>
.market-detail {
  display: flex;
  flex-direction: column;
  max-height: 78vh;
}
.detail-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--sp-chrome-border, #494e52);
}
.detail-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--sp-chrome-text, #d8dcdf);
}
.detail-head .in-use {
  margin-left: auto;
  font-size: 11px;
  font-weight: 600;
  color: #fff;
  background: var(--primary-color, #5ea0ff);
  padding: 4px 10px;
  border-radius: 999px;
}
.detail-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 18px 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.detail-preview {
  width: 100%;
  aspect-ratio: 16 / 9;
  border-radius: 12px;
  overflow: hidden;
  background: #000;
  border: 1px solid var(--sp-chrome-border, #494e52);
}
.detail-meta {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.detail-fields {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.detail-fields .row {
  display: flex;
  gap: 12px;
  font-size: 13px;
}
.detail-fields dt {
  flex: none;
  width: 48px;
  color: var(--sp-chrome-text-dim, #98a0a6);
}
.detail-fields dd {
  margin: 0;
  color: var(--sp-chrome-text, #d8dcdf);
  word-break: break-all;
}
.detail-fields dd.link {
  color: var(--primary-color, #5ea0ff);
}
.detail-section h4 {
  margin: 0 0 6px;
  font-size: 13px;
  font-weight: 700;
  color: var(--primary-color, #5ea0ff);
}
.detail-section p {
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
  color: var(--sp-chrome-text, #d8dcdf);
}
.detail-section p.pre-wrap {
  white-space: pre-wrap;
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
.detail-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  padding: 14px 20px;
  border-top: 1px solid var(--sp-chrome-border, #494e52);
}
</style>
