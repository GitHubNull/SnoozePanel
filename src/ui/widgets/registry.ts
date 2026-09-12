/**
 * 内容组件注册表（类型/样式两级）。
 *
 * 构建时通过 Vite import.meta.glob 扫描 widgets/ 目录自动收集，并合并「运行时安装」的
 * 第三方样式（宿主 SDK registerWidget 注册）。
 * 约定：
 *   - 类型目录 widgets/<type>/，其下每个样式一个子目录 widgets/<type>/<style>/；
 *   - 样式入口为 widgets/<type>/<style>/index.vue（必需）；
 *   - 样式元数据为 widgets/<type>/<style>/widget.meta.ts（可选），导出 { label, author?, ..., schema? }；
 *   - 第三方样式放 widgets/thirdparty/<type>/<style>/，source 自动标记为 'thirdparty'；
 *     第三方与内置同 type+style 时「第三方覆盖内置」。
 *
 * 新增/替换内置样式 = 放入目录即生效；第三方预编译包由运行时注册（见 plugins/sdk.ts）。
 * 内置类型：calendar / date / lunar / weather / text。
 */

import { shallowRef } from 'vue';
import type { Component } from 'vue';
import type { PluginMeta, PropertyField, WidgetPluginMeta } from '@/ui/plugins/types';
import type { WidgetStyleMeta, WidgetStyleOption, WidgetSource } from './types';

/** widget.meta.ts 的可选导出形状 */
interface WidgetMetaModule extends PluginMeta {
  label?: string;
}

// 构建时收集：eager 同步打包进单文件 IIFE 产物（禁止运行时外发请求）
// 内置样式：widgets/<type>/<style>/index.vue（排除 thirdparty 子目录）
const builtinModules = import.meta.glob<{ default: Component }>(
  ['./*/*/index.vue', '!./thirdparty/**'],
  { eager: true },
);
// 第三方样式：widgets/thirdparty/<type>/<style>/index.vue
const thirdpartyModules = import.meta.glob<{ default: Component }>('./thirdparty/*/*/index.vue', { eager: true });
const metaModules = import.meta.glob<{ default?: WidgetMetaModule } & WidgetMetaModule>(
  ['./*/*/widget.meta.ts', '!./thirdparty/**'],
  { eager: true },
);
const thirdpartyMetaModules = import.meta.glob<{ default?: WidgetMetaModule } & WidgetMetaModule>(
  './thirdparty/*/*/widget.meta.ts',
  { eager: true },
);

/** 从模块路径解析类型与样式，如 './calendar/basic/index.vue' → { type:'calendar', style:'basic' } */
function parsePath(path: string): { type: string; style: string } | null {
  const m = /^\.\/(?:thirdparty\/)?([^/]+)\/([^/]+)\//.exec(path);
  return m ? { type: m[1], style: m[2] } : null;
}

/** 抽出元数据中的可选字段（避免写入 undefined 键） */
function pickMeta(m: WidgetMetaModule | undefined): PluginMeta {
  const out: PluginMeta = {};
  if (!m) return out;
  if (m.author) out.author = m.author;
  if (m.version) out.version = m.version;
  if (m.summary) out.summary = m.summary;
  if (m.description) out.description = m.description;
  if (m.usage) out.usage = m.usage;
  if (m.homepage) out.homepage = m.homepage;
  if (m.license) out.license = m.license;
  if (Array.isArray(m.schema)) out.schema = m.schema;
  return out;
}

function buildRegistry(): Map<string, WidgetStyleMeta> {
  const map = new Map<string, WidgetStyleMeta>();

  const collect = (
    mods: Record<string, { default: Component }>,
    metas: Record<string, { default?: WidgetMetaModule } & WidgetMetaModule>,
    source: WidgetSource,
  ): void => {
    for (const [path, mod] of Object.entries(mods)) {
      const parsed = parsePath(path);
      if (!parsed) continue;
      const { type, style } = parsed;
      const prefix = source === 'thirdparty' ? './thirdparty/' : './';
      const metaMod = metas[`${prefix}${type}/${style}/widget.meta.ts`];
      const meta: WidgetMetaModule = metaMod?.default ?? metaMod ?? {};
      map.set(`${type}/${style}`, {
        type,
        style,
        label: meta.label ?? style,
        source,
        component: mod.default,
        ...pickMeta(meta),
      });
    }
  };

  collect(builtinModules, metaModules, 'builtin');
  // 第三方（同 type+style 覆盖内置）
  collect(thirdpartyModules, thirdpartyMetaModules, 'thirdparty');

  return map;
}

const REGISTRY = buildRegistry();

/** 运行时安装的内容组件样式（宿主 SDK 注册，覆盖同 type+style 的构建期项） */
const RUNTIME = new Map<string, WidgetStyleMeta>();

/** 内容组件注册表变更计数（响应式），驱动市场/下拉/预览自动刷新 */
export const widgetsVersion = shallowRef(0);

/** 注册运行时内容组件样式。返回是否新增（此前 type+style 不存在） */
export function registerRuntimeWidget(meta: WidgetPluginMeta): boolean {
  const key = `${meta.type}/${meta.style}`;
  const isNew = !REGISTRY.has(key) && !RUNTIME.has(key);
  RUNTIME.set(key, {
    type: meta.type,
    style: meta.style,
    label: meta.label,
    source: 'thirdparty',
    component: meta.component,
    installed: true,
    ...pickMeta(meta as WidgetMetaModule),
  });
  widgetsVersion.value++;
  return isNew;
}

/** 反注册运行时内容组件样式；返回是否确有移除 */
export function unregisterRuntimeWidget(type: string, style: string): boolean {
  const ok = RUNTIME.delete(`${type}/${style}`);
  if (ok) widgetsVersion.value++;
  return ok;
}

/** 合并视图：构建期项 + 运行时项（运行时覆盖同 key） */
function mergedWidgets(): Map<string, WidgetStyleMeta> {
  if (RUNTIME.size === 0) return REGISTRY;
  return new Map<string, WidgetStyleMeta>([...REGISTRY, ...RUNTIME]);
}

/** 各类型中文显示名（类型下拉 / 弹窗标题用） */
export const WIDGET_TYPE_LABELS: Record<string, string> = {
  calendar: '日历',
  date: '日期',
  lunar: '农历',
  weather: '天气',
  text: '自定义文本',
};

/** 默认组件类型 id（找不到时的回退） */
export const DEFAULT_WIDGET_TYPE = 'text';

/** 各类型默认样式 id（找不到时的回退） */
export const DEFAULT_WIDGET_STYLE: Record<string, string> = {
  calendar: 'basic',
  date: 'basic',
  lunar: 'basic',
  weather: 'basic',
  text: 'basic',
};

/**
 * 类型级默认属性 schema（内置样式的兜底声明）。
 * 内置字段以 bind:'field' 复用组件顶层字段，保持单一数据源；
 * 第三方/新增参数在各自 widget.meta.ts 中以 bind:'option' 声明。
 */
export const WIDGET_TYPE_SCHEMA: Record<string, PropertyField[]> = {
  calendar: [
    { key: 'week_start', label: '周起始日', type: 'select', bind: 'field', default: 1,
      options: [{ label: '周一', value: 1 }, { label: '周日', value: 0 }] },
    { key: 'show_week_number', label: '显示周数', type: 'boolean', bind: 'field', default: false },
    { key: 'format', label: '日期格式模板', type: 'text', bind: 'field',
      hint: '占位符：YYYY 年 / MM 月 / M 月 / DD 日 / D 日 / dddd 星期' },
  ],
  date: [
    { key: 'format', label: '日期格式模板', type: 'text', bind: 'field',
      hint: '占位符：YYYY/YY/MM/M/DD/D/dddd/ddd' },
  ],
  lunar: [
    { key: 'format', label: '格式模板', type: 'text', bind: 'field',
      hint: '占位符：{lunar_month} 月 / {lunar_day} 日 / {ganzhi} 干支 / {zodiac} 生肖' },
  ],
  weather: [
    { key: 'entity', label: '天气实体', type: 'text', bind: 'field', hint: '如 weather.home' },
  ],
  text: [
    { key: 'content', label: '文本内容', type: 'textarea', bind: 'field',
      hint: '支持实体占位符，如 室温 {sensor.temp}°C' },
    { key: 'show', label: '显示该条文本', type: 'boolean', bind: 'field', default: true },
  ],
};

/** 判断类型 id 是否为已登记的内置类型 */
export function isWidgetType(type: string): boolean {
  return type in WIDGET_TYPE_LABELS;
}

/**
 * 列出某类型下全部样式：内置在前、第三方在后，各按 style 字典序。
 */
export function listWidgetStyles(type: string): WidgetStyleMeta[] {
  const all = Array.from(mergedWidgets().values()).filter((m) => m.type === type);
  return all.sort((a, b) => {
    if (a.source !== b.source) return a.source === 'builtin' ? -1 : 1;
    return a.style.localeCompare(b.style);
  });
}

/**
 * 解析内容组件样式：type 未登记回退默认类型；style 缺省/未命中回退默认样式、再退化为该类型首个。
 * @param type 组件类型 id
 * @param style 样式 id（可选）
 */
export function getWidget(type: string, style?: string): WidgetStyleMeta {
  const map = mergedWidgets();
  const t = isWidgetType(type) ? type : DEFAULT_WIDGET_TYPE;
  const s = typeof style === 'string' && style.trim() ? style.trim() : (DEFAULT_WIDGET_STYLE[t] ?? 'basic');
  const hit = map.get(`${t}/${s}`);
  if (hit) return hit;
  const fallback = map.get(`${t}/${DEFAULT_WIDGET_STYLE[t] ?? 'basic'}`);
  if (fallback) return fallback;
  const first = listWidgetStyles(t)[0];
  if (first) return first;
  return map.values().next().value as WidgetStyleMeta;
}

/**
 * 解析某 type+style 的属性 schema：样式级 schema 优先，缺省回退类型级默认 schema。
 * @param type 组件类型 id
 * @param style 样式 id（可选）
 */
export function getWidgetSchema(type: string, style?: string): PropertyField[] {
  const meta = getWidget(type, style);
  if (Array.isArray(meta.schema) && meta.schema.length) return meta.schema;
  return WIDGET_TYPE_SCHEMA[meta.type] ?? [];
}

/** 判断某 type+style 是否已注册 */
export function hasWidget(type: string, style: string): boolean {
  return mergedWidgets().has(`${type}/${style}`);
}

/** 列出全部已登记类型（含中文名，顺序与 WIDGET_TYPE_LABELS 一致） */
export function listWidgetTypes(): { type: string; label: string }[] {
  return Object.entries(WIDGET_TYPE_LABELS).map(([type, label]) => ({ type, label }));
}

/** 列出某类型下全部样式的纯数据摘要（不含组件引用，排序与 listWidgetStyles 一致） */
export function listWidgetStyleOptions(type: string): WidgetStyleOption[] {
  return listWidgetStyles(type).map((s) => ({
    type: s.type,
    style: s.style,
    label: s.label,
    source: s.source,
    ...(s.author ? { author: s.author } : {}),
    ...(s.version ? { version: s.version } : {}),
    ...(s.summary ? { summary: s.summary } : {}),
    ...(s.description ? { description: s.description } : {}),
    ...(s.usage ? { usage: s.usage } : {}),
    ...(s.homepage ? { homepage: s.homepage } : {}),
    ...(s.license ? { license: s.license } : {}),
    ...(s.installed ? { installed: s.installed } : {}),
    ...(s.schema ? { schema: s.schema } : {}),
  }));
}
