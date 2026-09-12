/**
 * 屏幕尺寸预设与解析（纯函数，无 DOM 依赖）。
 *
 * DevicePreview（编辑器内的模拟设备面板）按此尺寸作为「模拟视口」渲染屏保，
 * 再等比缩放适配面板——语义等价于 Chrome DevTools 的设备模拟（手机/平板屏幕）。
 *
 * 该尺寸随 SnoozeConfig 持久化；生产屏保始终全屏，不受此字段影响。
 * 本模块不 import 任何其他 core 模块，避免与 types.ts 形成循环依赖。
 */

/** 屏幕尺寸配置（随 SnoozeConfig 持久化） */
export interface ScreenSize {
  /** 预设 id（SCREEN_PRESETS 之一，或 CUSTOM_PRESET_ID） */
  preset: string;
  /** 屏幕宽（设备 CSS px） */
  width: number;
  /** 屏幕高（设备 CSS px） */
  height: number;
}

/** 屏幕尺寸预设（带中文名称标识） */
export interface ScreenPreset {
  id: string;
  label: string;
  width: number;
  height: number;
}

/** 自定义预设 id（用户手动输入宽高） */
export const CUSTOM_PRESET_ID = 'custom';

/** 宽高夹取范围（设备 CSS px） */
export const SCREEN_DIM_LIMITS = { min: 120, max: 4096 } as const;

/** 预设档位：常见智能手表 / 手机 / 平板尺寸 */
export const SCREEN_PRESETS: ScreenPreset[] = [
  { id: 'watch-360', label: '方形手表 360×360', width: 360, height: 360 },
  { id: 'watch-454', label: '方形手表 454×454', width: 454, height: 454 },
  { id: 'phone-390', label: '全面屏手机 390×844', width: 390, height: 844 },
  { id: 'phone-430', label: '大屏手机 430×932', width: 430, height: 932 },
  { id: 'tablet-1024', label: '平板 1024×768（横屏）', width: 1024, height: 768 },
  { id: 'tablet-1280', label: '平板 1280×800（横屏）', width: 1280, height: 800 },
];

/** 默认屏幕尺寸（贴合常见 HA 墙面平板：横屏 1280×800） */
export const DEFAULT_SCREEN: ScreenSize = { preset: 'tablet-1280', width: 1280, height: 800 };

/** 按 id 取预设（不存在返回 undefined） */
export function presetById(id: string): ScreenPreset | undefined {
  return SCREEN_PRESETS.find((p) => p.id === id);
}

/** 夹取尺寸到合法范围（非法值回退 fallback） */
export function clampScreenDim(v: unknown, fallback: number): number {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(SCREEN_DIM_LIMITS.max, Math.max(SCREEN_DIM_LIMITS.min, Math.round(n)));
}

/** 按宽高匹配预设 id（命中返回其 id，否则 CUSTOM_PRESET_ID） */
export function matchPreset(width: number, height: number): string {
  const p = SCREEN_PRESETS.find((s) => s.width === width && s.height === height);
  return p ? p.id : CUSTOM_PRESET_ID;
}

/** 尺寸是否为一对合法数字 */
function hasDims(width: unknown, height: unknown): boolean {
  return (
    typeof width === 'number' && Number.isFinite(width) &&
    typeof height === 'number' && Number.isFinite(height)
  );
}

/**
 * 解析屏幕尺寸为自洽结果。
 * - 提供合法宽高 → 采用宽高并夹取，preset 由 matchPreset 校正为实际命中的预设；
 * - 未提供宽高但 preset 命中预设 → 用预设宽高；
 * - 其余 → 回退默认尺寸。
 */
export function resolveScreen(preset: unknown, width: unknown, height: unknown): ScreenSize {
  const pid = typeof preset === 'string' && preset.trim() ? preset.trim() : CUSTOM_PRESET_ID;
  const p = presetById(pid);
  if (hasDims(width, height)) {
    const w = clampScreenDim(width, p ? p.width : DEFAULT_SCREEN.width);
    const h = clampScreenDim(height, p ? p.height : DEFAULT_SCREEN.height);
    return { preset: matchPreset(w, h), width: w, height: h };
  }
  if (p) return { preset: p.id, width: p.width, height: p.height };
  return { ...DEFAULT_SCREEN };
}
