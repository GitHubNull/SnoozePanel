/**
 * 内容组件注册表：构建时通过 Vite import.meta.glob 扫描 widgets/ 目录，自动收集所有内容组件。
 *
 * 约定：
 *   - 每个内容组件一个子目录 widgets/<id>/；
 *   - 入口组件为 widgets/<id>/index.vue（必需）；
 *   - 元数据为 widgets/<id>/widget.meta.ts（可选），导出 { id?, label }；
 *     缺省 id 取目录名，label 取 id。
 *   - 第三方组件放 widgets/thirdparty/<id>/，source 自动标记为 'thirdparty'；
 *     第三方与内置同 id 时「第三方覆盖内置」。
 *
 * 新增/替换内容组件 = 放入目录即生效，无需改本文件（内置 id：calendar/date/lunar/weather/text）。
 */

import type { Component } from 'vue';
import type { WidgetMeta, WidgetOption } from './types';

/** widget.meta.ts 的可选导出形状 */
interface WidgetMetaModule {
  id?: string;
  label?: string;
}

// 构建时收集：eager 同步打包进单文件 IIFE 产物（禁止运行时外发请求）
// 内置组件：widgets/<id>/index.vue（排除 thirdparty 子目录）
const builtinModules = import.meta.glob<{ default: Component }>('./*/index.vue', { eager: true });
// 第三方组件：widgets/thirdparty/<id>/index.vue
const thirdpartyModules = import.meta.glob<{ default: Component }>('./thirdparty/*/index.vue', { eager: true });
const metaModules = import.meta.glob<{ default?: WidgetMetaModule } & WidgetMetaModule>('./*/widget.meta.ts', { eager: true });
const thirdpartyMetaModules = import.meta.glob<{ default?: WidgetMetaModule } & WidgetMetaModule>('./thirdparty/*/widget.meta.ts', { eager: true });

/** 从模块路径提取组件目录名，如 './calendar/index.vue' -> 'calendar' 或 './thirdparty/foo/index.vue' -> 'foo' */
function dirName(path: string): string {
  const m = /^\.\/(?:thirdparty\/)?([^/]+)\//.exec(path);
  return m ? m[1] : path;
}

function buildRegistry(): Map<string, WidgetMeta> {
  const map = new Map<string, WidgetMeta>();

  // 内置组件
  for (const [path, mod] of Object.entries(builtinModules)) {
    const id = dirName(path);
    const metaMod = metaModules[`./${id}/widget.meta.ts`];
    const meta: WidgetMetaModule = metaMod?.default ?? metaMod ?? {};
    map.set(id, {
      id: meta.id ?? id,
      label: meta.label ?? id,
      source: 'builtin',
      component: mod.default,
    });
  }

  // 第三方组件（同 id 覆盖内置）
  for (const [path, mod] of Object.entries(thirdpartyModules)) {
    const id = dirName(path);
    const metaMod = thirdpartyMetaModules[`./thirdparty/${id}/widget.meta.ts`];
    const meta: WidgetMetaModule = metaMod?.default ?? metaMod ?? {};
    map.set(id, {
      id: meta.id ?? id,
      label: meta.label ?? id,
      source: 'thirdparty',
      component: mod.default,
    });
  }

  return map;
}

const REGISTRY = buildRegistry();

/** 默认内容组件 id（找不到时的回退） */
export const DEFAULT_WIDGET_ID = 'text';

/** 按 id 取内容组件；不存在回退默认组件，再退化为注册表第一项 */
export function getWidget(id: string): WidgetMeta {
  return REGISTRY.get(id) ?? REGISTRY.get(DEFAULT_WIDGET_ID) ?? (REGISTRY.values().next().value as WidgetMeta);
}

/** 列出全部内容组件（编辑器 / 摘要用），按 id 字典序排列 */
export function listWidgets(): WidgetMeta[] {
  return Array.from(REGISTRY.values()).sort((a, b) => a.id.localeCompare(b.id));
}

/** 判断内容组件 id 是否已注册 */
export function hasWidget(id: string): boolean {
  return REGISTRY.has(id);
}

/** 列出全部内容组件的纯数据摘要（不含组件引用，排序与 listWidgets 一致） */
export function listWidgetOptions(): WidgetOption[] {
  return listWidgets().map(({ id, label, source }) => ({ id, label, source }));
}
