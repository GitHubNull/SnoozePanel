/**
 * 表盘注册表：构建时通过 Vite import.meta.glob 扫描 faces/ 目录自动收集，
 * 并合并「运行时安装」的第三方表盘（宿主 SDK registerFace 注册）。
 *
 * 约定：
 *   - 每个表盘一个子目录 faces/<id>/；
 *   - 入口组件为 faces/<id>/index.vue（必需）；
 *   - 元数据为 faces/<id>/face.meta.ts（可选），导出 { id?, label, kind, author?, ... schema? }；
 *     缺省 id 取目录名，label 取 id，kind 取 'analog'。
 *   - 第三方表盘放 faces/thirdparty/<id>/，source 自动标记为 'thirdparty'。
 *
 * 新增内置表盘 = 放入目录即生效；第三方预编译包由运行时注册（见 plugins/sdk.ts）。
 */

import { shallowRef } from 'vue';
import type { Component } from 'vue';
import type { FaceKind, FacePluginMeta, PluginMeta, PropertyField } from '@/ui/plugins/types';

// FaceKind 统一定义在 plugins/types.ts，这里再导出，兼容既有导入路径
export type { FaceKind } from '@/ui/plugins/types';

/** 表盘来源：系统内置 / 第三方安装 */
export type FaceSource = 'builtin' | 'thirdparty';

/** 表盘元数据 + 入口组件 */
export interface FaceMeta extends PluginMeta {
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
interface FaceMetaModule extends PluginMeta {
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

/** 抽出元数据中的可选字段（避免写入 undefined 键） */
function pickMeta(m: FaceMetaModule | undefined): PluginMeta {
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
      ...pickMeta(meta),
    });
  }

  // 第三方表盘（构建期打包进产物的）
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
      ...pickMeta(meta),
    });
  }

  return map;
}

const REGISTRY = buildRegistry();

/** 运行时安装的表盘（宿主 SDK 注册，覆盖同 id 的构建期项） */
const RUNTIME = new Map<string, FaceMeta>();

/**
 * 表盘注册表变更计数（响应式）。
 * 市场弹窗 / 下拉 / 预览的 computed 依赖它，运行时增删表盘后自动刷新。
 */
export const facesVersion = shallowRef(0);

/** 注册运行时表盘（第三方插件包）。同 id 覆盖既有项；返回是否新增（此前不存在） */
export function registerRuntimeFace(meta: FacePluginMeta): boolean {
  const isNew = !REGISTRY.has(meta.id) && !RUNTIME.has(meta.id);
  RUNTIME.set(meta.id, {
    id: meta.id,
    label: meta.label,
    kind: meta.kind,
    source: 'thirdparty',
    component: meta.component,
    installed: true,
    ...pickMeta(meta as FaceMetaModule),
  });
  facesVersion.value++;
  return isNew;
}

/** 反注册运行时表盘；返回是否确有移除 */
export function unregisterRuntimeFace(id: string): boolean {
  const ok = RUNTIME.delete(id);
  if (ok) facesVersion.value++;
  return ok;
}

/** 合并视图：构建期项 + 运行时项（运行时覆盖同 id） */
function mergedFaces(): Map<string, FaceMeta> {
  if (RUNTIME.size === 0) return REGISTRY;
  return new Map<string, FaceMeta>([...REGISTRY, ...RUNTIME]);
}

/** 默认表盘 id（找不到时的回退） */
export const DEFAULT_FACE_ID = 'digital';

/**
 * 时钟组件默认属性 schema（表盘未自定义 schema 时的兜底）。
 * hour24 / seconds 为时钟顶层字段，以 bind:'field' 复用单一数据源。
 */
export const CLOCK_TYPE_SCHEMA: PropertyField[] = [
  { key: 'hour24', label: '24 小时制', type: 'boolean', bind: 'field', default: true },
  { key: 'seconds', label: '显示秒', type: 'boolean', bind: 'field', default: false },
];

/** 按 id 取表盘；不存在回退默认表盘，再退化为注册表第一项 */
export function getFace(id: string): FaceMeta {
  const map = mergedFaces();
  return map.get(id) ?? map.get(DEFAULT_FACE_ID) ?? map.values().next().value as FaceMeta;
}

/** 列出全部表盘（编辑器下拉 / config 校验用），按 kind 分组排序：数字在前 */
export function listFaces(): FaceMeta[] {
  const all = Array.from(mergedFaces().values());
  return all.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'digital' ? -1 : 1;
    return a.id.localeCompare(b.id);
  });
}

/** 判断表盘 id 是否已注册 */
export function hasFace(id: string): boolean {
  return mergedFaces().has(id);
}

/** 纯数据形态的表盘摘要（不含组件引用，可安全跨全局 API / 序列化边界传递） */
export interface FaceOption extends PluginMeta {
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
  return listFaces().map((f) => ({
    id: f.id,
    label: f.label,
    kind: f.kind,
    source: f.source,
    ...(f.author ? { author: f.author } : {}),
    ...(f.version ? { version: f.version } : {}),
    ...(f.summary ? { summary: f.summary } : {}),
    ...(f.description ? { description: f.description } : {}),
    ...(f.usage ? { usage: f.usage } : {}),
    ...(f.homepage ? { homepage: f.homepage } : {}),
    ...(f.license ? { license: f.license } : {}),
    ...(f.installed ? { installed: f.installed } : {}),
    ...(f.schema ? { schema: f.schema } : {}),
  }));
}
