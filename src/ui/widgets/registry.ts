/**
 * 内容组件注册表（类型/样式两级）。
 *
 * 构建时通过 Vite import.meta.glob 扫描 widgets/ 目录，自动收集所有样式。
 * 约定：
 *   - 类型目录 widgets/<type>/，其下每个样式一个子目录 widgets/<type>/<style>/；
 *   - 样式入口为 widgets/<type>/<style>/index.vue（必需）；
 *   - 样式元数据为 widgets/<type>/<style>/widget.meta.ts（可选），导出 { label }；
 *   - 第三方样式放 widgets/thirdparty/<type>/<style>/，source 自动标记为 'thirdparty'；
 *     第三方与内置同 type+style 时「第三方覆盖内置」。
 *
 * 新增/替换样式 = 放入目录即生效，无需改本文件。
 * 内置类型：calendar / date / lunar / weather / text。
 */

import type { Component } from 'vue';
import type { WidgetStyleMeta, WidgetStyleOption, WidgetSource } from './types';

/** widget.meta.ts 的可选导出形状 */
interface WidgetMetaModule {
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
      });
    }
  };

  collect(builtinModules, metaModules, 'builtin');
  // 第三方（同 type+style 覆盖内置）
  collect(thirdpartyModules, thirdpartyMetaModules, 'thirdparty');

  return map;
}

const REGISTRY = buildRegistry();

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

/** 判断类型 id 是否为已登记的内置类型 */
export function isWidgetType(type: string): boolean {
  return type in WIDGET_TYPE_LABELS;
}

/**
 * 列出某类型下全部样式：内置在前、第三方在后，各按 style 字典序。
 */
export function listWidgetStyles(type: string): WidgetStyleMeta[] {
  const all = Array.from(REGISTRY.values()).filter((m) => m.type === type);
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
  const t = isWidgetType(type) ? type : DEFAULT_WIDGET_TYPE;
  const s = typeof style === 'string' && style.trim() ? style.trim() : (DEFAULT_WIDGET_STYLE[t] ?? 'basic');
  const hit = REGISTRY.get(`${t}/${s}`);
  if (hit) return hit;
  const fallback = REGISTRY.get(`${t}/${DEFAULT_WIDGET_STYLE[t] ?? 'basic'}`);
  if (fallback) return fallback;
  const first = listWidgetStyles(t)[0];
  if (first) return first;
  return REGISTRY.values().next().value as WidgetStyleMeta;
}

/** 判断某 type+style 是否已注册 */
export function hasWidget(type: string, style: string): boolean {
  return REGISTRY.has(`${type}/${style}`);
}

/** 列出全部已登记类型（含中文名，顺序与 WIDGET_TYPE_LABELS 一致） */
export function listWidgetTypes(): { type: string; label: string }[] {
  return Object.entries(WIDGET_TYPE_LABELS).map(([type, label]) => ({ type, label }));
}

/** 列出某类型下全部样式的纯数据摘要（不含组件引用，排序与 listWidgetStyles 一致） */
export function listWidgetStyleOptions(type: string): WidgetStyleOption[] {
  return listWidgetStyles(type).map(({ type: t, style, label, source }) => ({ type: t, style, label, source }));
}
