<script setup lang="ts">
/**
 * SnoozePanel 侧边栏全页配置界面。
 *
 * 由 HA panel_custom 加载，不依赖视图 YAML，直接从后端加载设备级配置。
 * 复用 EditorApp 核心表单，去掉卡片编辑器外壳，提供全页布局。
 */
import { reactive, onMounted, ref } from 'vue';
import type { SnoozeConfig } from '@/core/types';
import { DEFAULT_CONFIG } from '@/core/types';
import type { HassLike } from '@/core/hass';
import { loadDeviceConfig, saveDeviceConfig } from '@/core/store';
import { resolveDeviceId } from '@/core/device';
import EditorApp from '@/editor/EditorApp.vue';
import Toast from 'primevue/toast';
import { useToast } from 'primevue/usetoast';
import Button from 'primevue/button';

const props = defineProps<{
  hass: HassLike;
}>();

const toast = useToast();
const deviceId = resolveDeviceId();

// 配置状态：默认配置 → 后端加载设备级覆盖 → 合并
const config = reactive<SnoozeConfig>(JSON.parse(JSON.stringify(DEFAULT_CONFIG)) as SnoozeConfig);
const loading = ref(true);
const saving = ref(false);

onMounted(async () => {
  try {
    const override = await loadDeviceConfig(props.hass, deviceId);
    if (override) {
      // 简单合并：设备级覆盖字段优先
      Object.assign(config, override);
      if (override.components) {
        config.components = { ...config.components, ...override.components };
      }
      if (override.background) {
        config.background = { ...config.background, ...override.background };
      }
    }
  } catch {
    // 后端不可用，仅用默认配置
  } finally {
    loading.value = false;
  }
});

function onConfigChange(next: SnoozeConfig): void {
  Object.assign(config, JSON.parse(JSON.stringify(next)) as SnoozeConfig);
}

async function onSave(): Promise<void> {
  saving.value = true;
  try {
    const ok = await saveDeviceConfig(props.hass, deviceId, JSON.parse(JSON.stringify(config)) as SnoozeConfig);
    if (ok) {
      toast.add({
        severity: 'success',
        summary: '保存成功',
        detail: `配置已保存为本设备（${deviceId}）的独立覆盖。`,
        life: 3000,
      });
    } else {
      toast.add({
        severity: 'error',
        summary: '保存失败',
        detail: '后端未接受本次写入，请检查连接后重试。',
        life: 5000,
      });
    }
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: '保存异常',
      detail: err instanceof Error ? err.message : String(err),
      life: 5000,
    });
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="sidebar-app">
    <Toast position="bottom-right" />
    <header class="sidebar-header">
      <h1>SnoozePanel 屏保配置</h1>
      <p class="subtitle">本页面配置保存到 HA 后端，作为本设备（{{ deviceId }}）的独立覆盖，断电/重启/清缓存不丢失。</p>
    </header>

    <div v-if="loading" class="loading">
      <p>正在加载配置…</p>
    </div>

    <template v-else>
      <div class="editor-wrap">
        <EditorApp :config="config" :hass="hass" @change="onConfigChange" />
      </div>

      <div class="save-bar">
        <Button :loading="saving" label="保存配置到后端" icon="pi pi-check" @click="onSave" />
      </div>
    </template>
  </div>
</template>

<style scoped>
.sidebar-app {
  max-width: 800px;
  margin: 0 auto;
  padding: 24px 20px 80px;
}
.sidebar-header {
  margin-bottom: 24px;
}
.sidebar-header h1 {
  margin: 0 0 8px;
  font-size: 24px;
}
.subtitle {
  margin: 0;
  color: var(--secondary-text-color, #888);
  font-size: 14px;
  line-height: 1.6;
}
.loading {
  padding: 48px 0;
  text-align: center;
  color: var(--secondary-text-color, #888);
}
.editor-wrap {
  background: var(--card-background-color, #fff);
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
}
.save-bar {
  position: sticky;
  bottom: 20px;
  margin-top: 24px;
  padding: 16px;
  background: var(--card-background-color, #fff);
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.12);
  display: flex;
  justify-content: flex-end;
}
</style>
