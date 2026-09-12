<script setup lang="ts">
/**
 * 插件安装弹窗：把「预编译插件包」安装进运行时注册表。
 *
 * 两条通道（均为同源 / 本地，不引入任何外发请求）：
 *   - HA 本地目录：注入 <script src="/local/snoozepanel/plugins/<id>/<entry>">，由插件自注册；
 *   - 文件上传：选择 index.js（可选 plugin.json），本页读取文本 → Blob 加载。
 *
 * 安全：选择文件时即做类型 / 大小 / 内容校验（前端体验层闸门）；后端 install_plugin
 * 以同一组限额强制校验（服务端才是安全底线）。安装前必须确认信任提示。
 */
import { computed, onMounted, reactive, ref } from 'vue';
import Dialog from 'primevue/dialog';
import Tabs from 'primevue/tabs';
import TabList from 'primevue/tablist';
import Tab from 'primevue/tab';
import TabPanels from 'primevue/tabpanels';
import TabPanel from 'primevue/tabpanel';
import InputText from 'primevue/inputtext';
import Select from 'primevue/select';
import Button from 'primevue/button';
import Checkbox from 'primevue/checkbox';
import { listWidgetTypes } from '@/ui/widgets/registry';
import { installPlugin, listPlugins } from '@/core/pluginStore';
import { loadPlugin, PLUGIN_DIR_BASE } from '@/runtime/pluginLoader';
import {
  checkEntryPath,
  checkManifestFile,
  checkPluginCount,
  checkRecordSize,
  checkScriptContent,
  checkScriptFile,
  isValidPluginId,
  MAX_JS_BYTES,
  MAX_MANIFEST_BYTES,
  MAX_PLUGINS,
} from '@/core/pluginLimits';
import type { HassLike } from '@/core/hass';
import type { PluginKind, PluginManifest, PluginRecord } from '@/core/pluginTypes';

const props = defineProps<{
  /** hass（用于 WS 后端读写）；为 null 时禁用安装 */
  hass: HassLike | null;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'installed', id: string, kind: PluginKind): void;
}>();

const visible = ref(true);
const activeTab = ref<'dir' | 'upload'>('dir');
const busy = ref(false);
const errorMsg = ref('');
const okMsg = ref('');

/** 轻量提示文案 */
const jsLimitKb = MAX_JS_BYTES / 1024;
const manifestLimitKb = MAX_MANIFEST_BYTES / 1024;

const kindOptions: { label: string; value: PluginKind }[] = [
  { label: '表盘', value: 'face' },
  { label: '内容组件', value: 'widget' },
];
const widgetTypeOptions = listWidgetTypes().map((t) => ({ label: `${t.label}（${t.type}）`, value: t.type }));

/** 已安装插件 id（用于数量上限判断与覆盖提示） */
const installedIds = ref<string[]>([]);

async function refreshInstalled(): Promise<void> {
  if (!props.hass) return;
  installedIds.value = (await listPlugins(props.hass)).map((p) => p.id);
}

onMounted(() => {
  void refreshInstalled();
});

// ---- HA 本地目录通道 ----
const dir = reactive({ id: '', entry: 'index.js', kind: 'face' as PluginKind, type: 'text', style: '' });

// ---- 文件上传通道 ----
const up = reactive({
  code: '',
  scriptName: '',
  manifestName: '',
  id: '',
  entry: 'index.js',
  kind: 'face' as PluginKind,
  type: 'text',
  style: '',
  trust: false,
});

const upScriptLabel = computed(() => up.scriptName || '未选择');
const upManifestLabel = computed(() => up.manifestName || '可选（未选择）');

function onHide(): void {
  emit('close');
}

function resetMessages(): void {
  errorMsg.value = '';
  okMsg.value = '';
}

/** 组装插件清单 */
function buildManifest(
  id: string,
  kind: PluginKind,
  entry: string,
  type: string,
  style: string,
): PluginManifest {
  const manifest: PluginManifest = { id, kind, entry };
  if (kind === 'widget') {
    manifest.type = type;
    manifest.style = style;
  }
  return manifest;
}

/** 校验数量上限（覆盖已安装 id 时不受限制） */
function passesCount(id: string): boolean {
  if (installedIds.value.includes(id)) return true;
  const res = checkPluginCount(installedIds.value.length);
  if (!res.ok) {
    errorMsg.value = res.error ?? '';
    return false;
  }
  return true;
}

/** 落盘 + 运行时加载（两条通道共用） */
async function persistAndLoad(record: PluginRecord): Promise<void> {
  if (!props.hass) {
    errorMsg.value = '后端不可用（未连接 Home Assistant），无法安装';
    return;
  }
  if (!passesCount(record.id)) return;
  busy.value = true;
  try {
    const saved = await installPlugin(props.hass, record);
    if (!saved) {
      errorMsg.value = '保存失败：可能被后端限额拒绝，请查看 HA 日志';
      return;
    }
    const res = await loadPlugin(record);
    if (!res.ok) {
      errorMsg.value = '记录已保存，但脚本加载 / 注册失败：' + (res.error ?? '未知错误');
      return;
    }
    await refreshInstalled();
    okMsg.value = '安装成功';
    emit('installed', record.id, record.kind);
    setTimeout(() => {
      visible.value = false;
      emit('close');
    }, 500);
  } finally {
    busy.value = false;
  }
}

/** 目录通道安装 */
async function installDir(): Promise<void> {
  resetMessages();
  if (!isValidPluginId(dir.id.trim())) {
    errorMsg.value = '目录名（插件 id）非法：仅允许小写字母/数字/连字符，且以字母或数字开头';
    return;
  }
  const entryCheck = checkEntryPath(dir.entry.trim() || 'index.js');
  if (!entryCheck.ok) {
    errorMsg.value = entryCheck.error ?? '';
    return;
  }
  if (dir.kind === 'widget' && !dir.style.trim()) {
    errorMsg.value = '内容组件必须填写样式 id（style）';
    return;
  }
  const id = dir.id.trim();
  const entry = dir.entry.trim() || 'index.js';
  await persistAndLoad({
    id,
    kind: dir.kind,
    channel: 'dir',
    entry,
    enabled: true,
    manifest: buildManifest(id, dir.kind, entry, dir.type, dir.style.trim()),
    installed_at: Date.now(),
  });
}

/** 选择脚本文件（选择时即校验类型 / 大小 / 内容） */
async function onPickScript(e: Event): Promise<void> {
  resetMessages();
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  const typeRes = checkScriptFile({ name: file.name, size: file.size, type: file.type });
  if (!typeRes.ok) {
    errorMsg.value = typeRes.error ?? '';
    input.value = '';
    return;
  }
  const text = await file.text();
  const contentRes = checkScriptContent(text);
  if (!contentRes.ok) {
    errorMsg.value = contentRes.error ?? '';
    input.value = '';
    return;
  }
  up.code = text;
  up.scriptName = `${file.name}（${(file.size / 1024).toFixed(1)} KB）`;
}

/** 选择清单文件（可选，选择时即校验类型 / 大小 / JSON 解析） */
async function onPickManifest(e: Event): Promise<void> {
  resetMessages();
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  const typeRes = checkManifestFile({ name: file.name, size: file.size, type: file.type });
  if (!typeRes.ok) {
    errorMsg.value = typeRes.error ?? '';
    input.value = '';
    return;
  }
  let data: Partial<PluginManifest>;
  try {
    data = JSON.parse(await file.text()) as Partial<PluginManifest>;
  } catch {
    errorMsg.value = 'plugin.json 解析失败（非合法 JSON）';
    input.value = '';
    return;
  }
  up.manifestName = `${file.name}（${(file.size / 1024).toFixed(1)} KB）`;
  if (typeof data.id === 'string') up.id = data.id;
  if (data.kind === 'face' || data.kind === 'widget') up.kind = data.kind;
  if (typeof data.type === 'string') up.type = data.type;
  if (typeof data.style === 'string') up.style = data.style;
  if (typeof data.entry === 'string') up.entry = data.entry;
}

/** 上传通道安装 */
async function installUpload(): Promise<void> {
  resetMessages();
  if (!up.scriptName || !up.code) {
    errorMsg.value = '请先选择要安装的 index.js（.js）';
    return;
  }
  if (!isValidPluginId(up.id.trim())) {
    errorMsg.value = '插件 id 非法：请填写合法 id（小写字母/数字/连字符），或上传含 id 的 plugin.json';
    return;
  }
  const entryCheck = checkEntryPath(up.entry.trim() || 'index.js');
  if (!entryCheck.ok) {
    errorMsg.value = entryCheck.error ?? '';
    return;
  }
  if (up.kind === 'widget' && !up.style.trim()) {
    errorMsg.value = '内容组件必须填写样式 id（style）';
    return;
  }
  if (!up.trust) {
    errorMsg.value = '请先勾选信任提示（第三方代码将在本页以完整权限执行）';
    return;
  }
  const id = up.id.trim();
  const entry = up.entry.trim() || 'index.js';
  const manifest = buildManifest(id, up.kind, entry, up.type, up.style.trim());
  const manifestBytes = up.manifestName ? new Blob([JSON.stringify(manifest)]).size : 0;
  const recordBytes = new Blob([up.code]).size;
  const sizeRes = checkRecordSize(recordBytes, manifestBytes);
  if (!sizeRes.ok) {
    errorMsg.value = sizeRes.error ?? '';
    return;
  }
  await persistAndLoad({
    id,
    kind: up.kind,
    channel: 'upload',
    entry,
    enabled: true,
    manifest,
    code: up.code,
    installed_at: Date.now(),
  });
}
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    header="安装插件"
    :style="{ width: '92vw', maxWidth: '640px' }"
    :content-style="{ padding: '0' }"
    class="plugin-install-dialog"
    @hide="onHide"
  >
    <Tabs v-model:value="activeTab">
      <TabList>
        <Tab value="dir">HA 本地目录</Tab>
        <Tab value="upload">文件上传</Tab>
      </TabList>
      <TabPanels>
        <!-- HA 本地目录通道 -->
        <TabPanel value="dir">
          <div class="dialog-body">
            <p class="tip">
              将插件目录放入 <code>config/www/snoozepanel/plugins/&lt;id&gt;/</code>，
              本页按目录名组装 <code>{{ PLUGIN_DIR_BASE }}/&lt;id&gt;/&lt;entry&gt;</code> 并注入加载。
            </p>
            <div class="field">
              <label>目录名（插件 id）<span class="req">*</span></label>
              <InputText v-model="dir.id" class="w-full" placeholder="例如 my-clock" />
              <small>仅小写字母 / 数字 / 连字符</small>
            </div>
            <div class="field">
              <label>入口文件</label>
              <InputText v-model="dir.entry" class="w-full" placeholder="index.js" />
              <small>仅纯文件名，禁止路径穿越</small>
            </div>
            <div class="field">
              <label>种类</label>
              <Select v-model="dir.kind" :options="kindOptions" option-label="label" option-value="value" class="w-full" />
            </div>
            <template v-if="dir.kind === 'widget'">
              <div class="field">
                <label>组件类型</label>
                <Select v-model="dir.type" :options="widgetTypeOptions" option-label="label" option-value="value" class="w-full" />
              </div>
              <div class="field">
                <label>样式 id<span class="req">*</span></label>
                <InputText v-model="dir.style" class="w-full" placeholder="例如 my-style" />
              </div>
            </template>
            <div class="actions">
              <Button label="导入" icon="pi pi-download" :loading="busy" @click="installDir" />
            </div>
          </div>
        </TabPanel>

        <!-- 文件上传通道 -->
        <TabPanel value="upload">
          <div class="dialog-body">
            <div class="field">
              <label>脚本文件 index.js<span class="req">*</span></label>
              <input
                type="file"
                accept=".js,application/javascript,text/javascript"
                class="file-input"
                @change="onPickScript"
              />
              <small>仅 .js，≤ {{ jsLimitKb }} KB；选择时即校验类型 / 大小 / 内容。当前：{{ upScriptLabel }}</small>
            </div>
            <div class="field">
              <label>清单 plugin.json</label>
              <input type="file" accept=".json,application/json" class="file-input" @change="onPickManifest" />
              <small>可选，≤ {{ manifestLimitKb }} KB；用于自动填充 id / 种类 / 元数据。当前：{{ upManifestLabel }}</small>
            </div>
            <div class="field">
              <label>插件 id<span class="req">*</span></label>
              <InputText v-model="up.id" class="w-full" placeholder="例如 my-clock" />
            </div>
            <div class="field">
              <label>种类</label>
              <Select v-model="up.kind" :options="kindOptions" option-label="label" option-value="value" class="w-full" />
            </div>
            <template v-if="up.kind === 'widget'">
              <div class="field">
                <label>组件类型</label>
                <Select v-model="up.type" :options="widgetTypeOptions" option-label="label" option-value="value" class="w-full" />
              </div>
              <div class="field">
                <label>样式 id<span class="req">*</span></label>
                <InputText v-model="up.style" class="w-full" placeholder="例如 my-style" />
              </div>
            </template>
            <label class="trust-row">
              <Checkbox v-model="up.trust" binary />
              <span>我了解：第三方插件代码将在本页以完整权限执行，来源不可信时请勿安装。</span>
            </label>
            <div class="actions">
              <Button label="安装" icon="pi pi-upload" :loading="busy" @click="installUpload" />
            </div>
          </div>
        </TabPanel>
      </TabPanels>
    </Tabs>

    <p v-if="errorMsg" class="msg error">{{ errorMsg }}</p>
    <p v-if="okMsg" class="msg ok">{{ okMsg }}</p>
    <p class="limit-note">
      限额：脚本 ≤ {{ jsLimitKb }} KB · 清单 ≤ {{ manifestLimitKb }} KB · 已安装 ≤ {{ MAX_PLUGINS }} 个
    </p>
  </Dialog>
</template>

<style scoped>
.dialog-body {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  max-height: 58vh;
  overflow-y: auto;
}
.tip {
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
  color: var(--sp-chrome-text-dim, #98a0a6);
}
.tip code {
  font-family: monospace;
  background: rgba(94, 160, 255, 0.12);
  color: var(--primary-color, #5ea0ff);
  padding: 1px 5px;
  border-radius: 4px;
  font-size: 12px;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.field label {
  font-size: 13px;
  font-weight: 600;
}
.field .req {
  color: #e05a5a;
  margin-left: 2px;
}
.field small {
  font-size: 12px;
  line-height: 1.5;
  color: var(--sp-chrome-text-dim, #98a0a6);
}
.w-full {
  width: 100%;
}
.file-input {
  font-size: 13px;
  color: var(--sp-chrome-text, #d8dcdf);
}
.trust-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 13px;
  line-height: 1.5;
  padding: 10px 12px;
  border-radius: 8px;
  background: rgba(232, 180, 90, 0.12);
  box-shadow: inset 0 0 0 1px rgba(232, 180, 90, 0.4);
}
.actions {
  display: flex;
  justify-content: flex-end;
}
.msg {
  margin: 0 20px 8px;
  font-size: 13px;
  line-height: 1.5;
}
.msg.error {
  color: #ff6b6b;
}
.msg.ok {
  color: #4fc07d;
}
.limit-note {
  margin: 0 20px 16px;
  font-size: 12px;
  color: var(--sp-chrome-text-dim, #98a0a6);
}
</style>

<!-- Dialog Teleport 到 body，scoped 不生效的全局样式 -->
<style>
.plugin-install-dialog .p-dialog-content {
  background: var(--card-background-color, #10141d);
}
.plugin-install-dialog .p-tablist {
  background: var(--card-background-color, #10141d);
  border-bottom: 1px solid var(--divider-color, #2a3346);
}
</style>
