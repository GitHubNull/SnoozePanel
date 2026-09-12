// @ts-check
/**
 * dev 实测台跨模块共享的 JSDoc 类型定义。
 *
 * 这些类型与 src 侧对齐（见各条目注释），集中于此供各 dev 模块以
 * `@typedef {import('./types.js').X} X` 引用，避免在多处重复声明而漂移。
 * 由 tsconfig.dev.json（allowJs + checkJs）统一校验。
 */

/**
 * 日志级别。
 * @typedef {'info' | 'ok' | 'warn' | 'error'} LogLevel
 */

/**
 * 表盘纯数据摘要（与 src/ui/faces/registry.ts 的 FaceOption 对齐）。
 * @typedef {Object} FaceOption
 * @property {string} id
 * @property {string} label
 * @property {'digital' | 'analog'} kind
 * @property {'builtin' | 'thirdparty'} source
 */

/**
 * 表盘预览参数（与 src/runtime/preview.ts 的 FacePreviewOptions 对齐）。
 * @typedef {Object} FacePreviewOptions
 * @property {'midnight' | 'paper'} [theme]
 * @property {boolean} [seconds]
 * @property {boolean} [hour24]
 * @property {boolean} [showBackground]
 */

/**
 * 表盘预览句柄（与 src/runtime/preview.ts 的 FacePreviewHandle 对齐）。
 * @typedef {Object} FacePreviewHandle
 * @property {(faceId: string, opts?: FacePreviewOptions) => void} update
 * @property {() => void} destroy
 */

/**
 * SnoozeConfig（与 src/core/types.ts 对齐，dev 页仅作透传）。
 * @typedef {Record<string, unknown>} SnoozeConfig
 */

/**
 * 编辑器挂载句柄（与 src/main.ts 的 EditorHandle 对齐）。
 * @typedef {Object} EditorHandle
 * @property {() => SnoozeConfig} getConfig
 * @property {() => void} destroy
 */

/**
 * 产物暴露的实测支撑 API（与 src/main.ts 的 SnoozePanelTestApi 对齐）。
 * @typedef {Object} TestApi
 * @property {() => FaceOption[]} listFaces
 * @property {(host: HTMLElement, faceId: string, opts?: FacePreviewOptions) => FacePreviewHandle} mountFacePreview
 * @property {(host: HTMLElement, config: SnoozeConfig, hass: MockHass) => EditorHandle} mountEditor
 */

/**
 * mock hass 实体状态（与 src/core/hass.ts 的 HassEntityState 对齐）。
 * @typedef {Object} MockEntityState
 * @property {string} entity_id
 * @property {string} state
 * @property {Record<string, unknown>} attributes
 * @property {string} last_changed
 * @property {string} last_updated
 */

/**
 * mock hass（结构最小对齐 src/core/hass.ts 的 HassLike）。
 * @typedef {Object} MockHass
 * @property {Record<string, MockEntityState>} states
 * @property {{ name: string, is_admin: boolean }} user
 * @property {(domain: string, service: string, data?: Record<string, unknown>) => Promise<void>} callService
 * @property {(msg: Record<string, unknown>) => Promise<unknown>} callWS
 */

/**
 * snooze-panel 自定义元素的最小调用面。
 * @typedef {HTMLElement & {
 *   setConfig(config: Record<string, unknown>): void;
 *   hass: MockHass | null;
 * }} PanelElementLike
 */

export {};
