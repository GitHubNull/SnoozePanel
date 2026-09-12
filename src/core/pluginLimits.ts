/**
 * 插件上传/安装的限额与校验（纯函数，前后端同口径）。
 *
 * 安全定位：前端校验是体验层闸门（可被绕过），后端 custom component 以同一组
 * 数值与正则做强制校验才是安全底线；两侧共用下列常量，避免口径漂移。
 *
 * 本模块无任何 DOM 依赖，可被 editor / runtime 复用，也可单测。
 */

/** 单个 index.js 大小上限：512 KB */
export const MAX_JS_BYTES = 512 * 1024;
/** plugin.json 大小上限：64 KB */
export const MAX_MANIFEST_BYTES = 64 * 1024;
/** 单条安装记录总量上限（脚本 + 清单）：1 MB */
export const MAX_RECORD_BYTES = 1024 * 1024;
/** 已安装插件数量上限 */
export const MAX_PLUGINS = 100;
/** 插件 id 规则：小写字母/数字开头，仅含小写字母/数字/连字符，长度 1-64 */
export const PLUGIN_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;
/** 允许的脚本扩展名 */
export const ALLOWED_SCRIPT_EXT = ['.js'];
/** 允许的清单扩展名 */
export const ALLOWED_MANIFEST_EXT = ['.json'];

/** 待校验的最小文件描述（不依赖 DOM File 对象） */
export interface FileMeta {
  name: string;
  size: number;
  type?: string;
}

/** 校验结果 */
export interface LimitResult {
  ok: boolean;
  /** 失败时的中文原因 */
  error?: string;
}

/** 取小写扩展名（含点），无扩展名返回空串 */
function extOf(name: string): string {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i).toLowerCase() : '';
}

/** 校验插件 id 是否合法 */
export function isValidPluginId(id: string): boolean {
  return typeof id === 'string' && PLUGIN_ID_PATTERN.test(id);
}

/** 校验上传脚本文件（类型白名单 + 大小上限） */
export function checkScriptFile(file: FileMeta): LimitResult {
  if (!file || typeof file.name !== 'string') return { ok: false, error: '无法识别上传文件' };
  const ext = extOf(file.name);
  if (!ALLOWED_SCRIPT_EXT.includes(ext)) {
    return { ok: false, error: `仅允许 .js 脚本文件，当前为 ${ext || '未知类型'}` };
  }
  if (typeof file.size === 'number' && file.size > MAX_JS_BYTES) {
    return { ok: false, error: `脚本超过上限 ${MAX_JS_BYTES / 1024} KB` };
  }
  return { ok: true };
}

/** 校验清单文件（类型白名单 + 大小上限） */
export function checkManifestFile(file: FileMeta): LimitResult {
  if (!file || typeof file.name !== 'string') return { ok: false, error: '无法识别清单文件' };
  const ext = extOf(file.name);
  if (!ALLOWED_MANIFEST_EXT.includes(ext)) {
    return { ok: false, error: `清单仅允许 .json 文件，当前为 ${ext || '未知类型'}` };
  }
  if (typeof file.size === 'number' && file.size > MAX_MANIFEST_BYTES) {
    return { ok: false, error: `清单超过上限 ${MAX_MANIFEST_BYTES / 1024} KB` };
  }
  return { ok: true };
}

/** 校验脚本内容：拒绝空内容与含 NUL 字节的二进制文件 */
export function checkScriptContent(code: string): LimitResult {
  if (typeof code !== 'string' || code.trim() === '') {
    return { ok: false, error: '脚本内容为空' };
  }
  if (code.indexOf('\0') >= 0) {
    return { ok: false, error: '脚本含二进制内容（NUL 字节），已拒绝' };
  }
  return { ok: true };
}

/** 校验单条记录总量（脚本字节 + 清单字节） */
export function checkRecordSize(scriptBytes: number, manifestBytes = 0): LimitResult {
  const total = (Number(scriptBytes) || 0) + (Number(manifestBytes) || 0);
  if (total > MAX_RECORD_BYTES) {
    return { ok: false, error: `安装记录超过上限 ${MAX_RECORD_BYTES / 1024} KB` };
  }
  return { ok: true };
}

/**
 * 校验入口路径：仅允许纯文件名（.js），禁止路径穿越 / 绝对路径 / 反斜杠，
 * 防止越权读取 /local 目录外的资源。
 */
export function checkEntryPath(entry: string): LimitResult {
  if (typeof entry !== 'string' || !entry.trim()) return { ok: false, error: 'entry 不能为空' };
  if (entry.includes('..') || entry.startsWith('/') || entry.includes('\\')) {
    return { ok: false, error: 'entry 禁止路径穿越 / 绝对路径 / 反斜杠' };
  }
  if (extOf(entry) !== '.js') return { ok: false, error: 'entry 必须为 .js 文件' };
  return { ok: true };
}

/** 校验插件数量上限 */
export function checkPluginCount(current: number): LimitResult {
  if (Number(current) >= MAX_PLUGINS) {
    return { ok: false, error: `已达插件数量上限（${MAX_PLUGINS} 个）` };
  }
  return { ok: true };
}
