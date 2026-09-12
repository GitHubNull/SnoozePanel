/**
 * 标尺刻度计算（纯函数，无 DOM 依赖）。
 *
 * 供编辑器预览画布外挂的两把标尺（纵 / 横）使用：以模拟屏幕左下角为原点，
 * 默认按分辨率（设备 CSS px）刻度，可切换为厘米 / 毫米。
 * 物理长度按 Web / CSS 参考像素换算：1 英寸 = 96px（与真机物理尺寸无关，纯设计参照）。
 *
 * 刻度采用「nice step」策略：把轴向长度均分为不超过 maxMajors 段，
 * 取 1/2/5×10ⁿ 档位中的首个不小于该值的档位作为主刻度，次刻度取主刻度的 1/5。
 */

/** 每英寸 CSS 参考像素数（Web 标准） */
export const PX_PER_INCH = 96;
/** 每厘米像素数（≈37.795） */
export const PX_PER_CM = PX_PER_INCH / 2.54;
/** 每毫米像素数（≈3.7795） */
export const PX_PER_MM = PX_PER_INCH / 25.4;

/** 标尺单位：分辨率(px) / 厘米 / 毫米 */
export type RulerUnit = 'px' | 'cm' | 'mm';

/** 各单位的像素换算比（1 单位 = 多少设备 CSS px） */
export const PX_PER_UNIT: Record<RulerUnit, number> = {
  px: 1,
  cm: PX_PER_CM,
  mm: PX_PER_MM,
};

/** 单位显示文案（角标 / 刻度尾注用） */
export const RULER_UNIT_LABEL: Record<RulerUnit, string> = {
  px: 'px',
  cm: 'cm',
  mm: 'mm',
};

/** 单一刻度：pos 为距原点的设备像素，major 表示主刻度（带标签） */
export interface RulerTick {
  pos: number;
  major: boolean;
  label: string;
}

/** nice 步长档位（单位量） */
const NICE_STEPS = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000];
/** 主刻度段数目标（越小刻度越稀，默认 8 段） */
const DEFAULT_MAX_MAJORS = 8;
/** 每主刻度包含的次刻度数 */
const MINOR_PER_MAJOR = 5;

/** 标签格式化：整数原样，非整数保留 1 位小数 */
function formatValue(value: number): string {
  if (!Number.isFinite(value)) return '';
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

/**
 * 计算某轴向的刻度序列。
 * @param lengthPx 轴长度（设备像素，通常为屏幕宽或高）
 * @param unit     标尺单位
 * @param maxMajors 主刻度段数上限（默认 8）
 * @returns 距原点由近及远的刻度数组；lengthPx <= 0 时返回空数组
 */
export function computeRulerTicks(
  lengthPx: number,
  unit: RulerUnit,
  maxMajors = DEFAULT_MAX_MAJORS,
): RulerTick[] {
  if (!Number.isFinite(lengthPx) || lengthPx <= 0) return [];
  const unitPx = PX_PER_UNIT[unit];
  const lengthUnits = lengthPx / unitPx;
  const rawMajor = lengthUnits / Math.max(1, maxMajors);
  const majorUnits = NICE_STEPS.find((n) => n >= rawMajor) ?? NICE_STEPS[NICE_STEPS.length - 1];
  const minorPx = (majorUnits / MINOR_PER_MAJOR) * unitPx;

  const ticks: RulerTick[] = [];
  // 浮点累加易漂移，故按索引乘步长，并用 epsilon 容差收尾
  for (let i = 0; ; i += 1) {
    const pos = i * minorPx;
    if (pos > lengthPx + 1e-6) break;
    const major = i % MINOR_PER_MAJOR === 0;
    ticks.push({ pos, major, label: major ? formatValue(pos / unitPx) : '' });
  }
  return ticks;
}
