/**
 * 表盘注册表：构建时通过 Vite import.meta.glob 扫描 faces/ 目录，自动收集所有表盘。
 *
 * 约定：
 *   - 每个表盘一个子目录 faces/<id>/；
 *   - 入口组件为 faces/<id>/index.vue（必需）；
 *   - 元数据为 faces/<id>/face.meta.ts（可选），导出 { id?, label, kind }；
 *     缺省 id 取目录名，label 取 id，kind 取 'analog'。
 *   - 第三方表盘放 faces/thirdparty/<id>/，source 自动标记为 'thirdparty'。
 *
 * 新增表盘 = 放入目录即生效，无需改本文件。
 */

import type { Component } from 'vue';

/** 表盘大类：数字 / 模拟 */
export type FaceKind = 'digital' | 'analog';

/** 表盘来源：系统内置 / 第三方安装 */
export type FaceSource = 'builtin' | 'thirdparty';

/** 表盘元数据 + 入口组件 */
export interface FaceMeta {
  /** 表盘唯一 id（目录名） */
  id: string;
  /** 中文显示名（编辑器下拉用） */
  label: string;
  /** 数字 / 模拟 */
  kind: FaceKind;
  /** 来源：builtin（系统内置）/ thirdparty（第三方安装） */
  source: FaceSource;
  /** 入口组件 */
  component: Component;
}

/** face.meta.ts 的可选导出形状 */
interface FaceMetaModule {
  id?: string;
  label?: string;
  kind?: FaceKind;
}

// 构建时收集：eager 同步打包进单文件 IIFE 产物
// 内置表盘：faces/<id>/index.vue（排除 thirdparty 子目录）
const builtinModules = import.meta.glob<{ default: Component }>('./*/index.vue', { eager: true });
// 第三方表盘：faces/thirdparty/<id>/index.vue
const thirdpartyModules = import.meta.glob<{ default: Component }>('./thirdparty/*/index.vue', { eager: true });
const metaModules = import.meta.glob<{ default?: FaceMetaModule } & FaceMetaModule>('./*/face.meta.ts', { eager: true });
const thirdpartyMetaModules = import.meta.glob<{ default?: FaceMetaModule } & FaceMetaModule>('./thirdparty/*/face.meta.ts', { eager: true });

/** 从模块路径提取表盘目录名，如 './chrono/index.vue' -> 'chrono' 或 './thirdparty/foo/index.vue' -> 'foo' */
function dirName(path: string): string {
  const m = /^\.\/(?:thirdparty\/)?([^/]+)\//.exec(path);
  return m ? m[1] : path;
}

function buildRegistry(): Map<string, FaceMeta> {
  const map = new Map<string, FaceMeta>();

  // 内置表盘
  for (const [path, mod] of Object.entries(builtinModules)) {
    const id = dirName(path);
    const metaMod = metaModules[`./${id}/face.meta.ts`];
    const meta: FaceMetaModule = metaMod?.default ?? metaMod ?? {};
    map.set(id, {
      id: meta.id ?? id,
      label: meta.label ?? id,
      kind: meta.kind ?? 'analog',
      source: 'builtin',
      component: mod.default,
    });
  }

  // 第三方表盘
  for (const [path, mod] of Object.entries(thirdpartyModules)) {
    const id = dirName(path);
    const metaMod = thirdpartyMetaModules[`./thirdparty/${id}/face.meta.ts`];
    const meta: FaceMetaModule = metaMod?.default ?? metaMod ?? {};
    map.set(id, {
      id: meta.id ?? id,
      label: meta.label ?? id,
      kind: meta.kind ?? 'analog',
      source: 'thirdparty',
      component: mod.default,
    });
  }

  return map;
}

const REGISTRY = buildRegistry();

/** 默认表盘 id（找不到时的回退） */
export const DEFAULT_FACE_ID = 'digital';

/** 按 id 取表盘；不存在回退默认表盘，再退化为注册表第一项 */
export function getFace(id: string): FaceMeta {
  return REGISTRY.get(id) ?? REGISTRY.get(DEFAULT_FACE_ID) ?? REGISTRY.values().next().value as FaceMeta;
}

/** 列出全部表盘（编辑器下拉 / config 校验用），按 kind 分组排序：数字在前 */
export function listFaces(): FaceMeta[] {
  const all = Array.from(REGISTRY.values());
  return all.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'digital' ? -1 : 1;
    return a.id.localeCompare(b.id);
  });
}

/** 判断表盘 id 是否已注册 */
export function hasFace(id: string): boolean {
  return REGISTRY.has(id);
}

/** 纯数据形态的表盘摘要（不含组件引用，可安全跨全局 API / 序列化边界传递） */
export interface FaceOption {
  /** 表盘唯一 id（目录名） */
  id: string;
  /** 中文显示名 */
  label: string;
  /** 数字 / 模拟 */
  kind: FaceKind;
  /** 来源：builtin / thirdparty */
  source: FaceSource;
}

/** 列出全部表盘的纯数据摘要（dev 实测页与编辑器下拉选项消费；排序与 listFaces 一致） */
export function listFaceOptions(): FaceOption[] {
  return listFaces().map(({ id, label, kind, source }) => ({ id, label, kind, source }));
}
