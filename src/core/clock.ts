/**
 * 时钟 / 日历工具：日期格式模板、ISO 周数、日历网格生成。
 */

const WEEKDAY_CN = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const WEEKDAY_CN_SHORT = ['日', '一', '二', '三', '四', '五', '六'];

/**
 * 日期格式模板渲染。支持占位符：
 *   YYYY 年  M 月(无前导零)  MM 月(两位)  D 日  DD 日(两位)
 *   dddd 星期全称(周日)  ddd 星期简称(日)
 */
export function formatDate(date: Date, format: string): string {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const wd = date.getDay();
  return format
    .replace(/YYYY/g, String(y))
    .replace(/MM/g, String(m).padStart(2, '0'))
    .replace(/M/g, String(m))
    .replace(/DD/g, String(d).padStart(2, '0'))
    .replace(/D/g, String(d))
    .replace(/dddd/g, WEEKDAY_CN[wd])
    .replace(/ddd/g, WEEKDAY_CN_SHORT[wd]);
}

/** ISO 8601 周数 */
export function isoWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7; // 周日=7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum); // 移到本周周四
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

export interface CalendarCell {
  date: Date;
  inCurrentMonth: boolean;
  isToday: boolean;
}

/**
 * 生成月历网格（6 行 × 7 列）。
 * @param year  年
 * @param month 月 0-11
 * @param weekStart 周起始日 0=周日 1=周一
 */
export function buildCalendarGrid(year: number, month: number, weekStart: 0 | 1): CalendarCell[][] {
  const first = new Date(year, month, 1);
  const today = new Date();
  const todayKey = today.toDateString();

  // 计算网格起始日（第一周的第一天）
  const firstWeekday = first.getDay(); // 0=周日
  const offset = weekStart === 1
    ? (firstWeekday === 0 ? 6 : firstWeekday - 1) // 周一起始
    : firstWeekday; // 周日起始
  const start = new Date(year, month, 1 - offset);

  const grid: CalendarCell[][] = [];
  for (let row = 0; row < 6; row++) {
    const cells: CalendarCell[] = [];
    for (let col = 0; col < 7; col++) {
      const idx = row * 7 + col;
      const cell = new Date(start.getFullYear(), start.getMonth(), start.getDate() + idx);
      cells.push({
        date: cell,
        inCurrentMonth: cell.getMonth() === month,
        isToday: cell.toDateString() === todayKey,
      });
    }
    grid.push(cells);
  }
  return grid;
}

/** 周表头（按周起始日排列） */
export function weekdayHeaders(weekStart: 0 | 1): string[] {
  if (weekStart === 1) {
    return ['一', '二', '三', '四', '五', '六', '日'];
  }
  return ['日', '一', '二', '三', '四', '五', '六'];
}

/** 数字时钟格式化 */
export function formatClock(date: Date, hour24: boolean, seconds: boolean): { main: string; period: string } {
  let h = date.getHours();
  const m = date.getMinutes();
  const s = date.getSeconds();
  let period = '';
  if (!hour24) {
    period = h < 12 ? 'AM' : 'PM';
    h = h % 12;
    if (h === 0) h = 12;
  }
  const hh = String(h).padStart(2, '0');
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  const main = seconds ? `${hh}:${mm}:${ss}` : `${hh}:${mm}`;
  return { main, period };
}

/** 模拟表盘指针角度（度，12 点方向为 0，顺时针） */
export interface ClockHands {
  hour: number;
  minute: number;
  second: number;
}

/** 计算时/分/秒针角度。秒针连续平滑（含毫秒），时针/分针随下位单位连续转动。 */
export function clockHands(date: Date): ClockHands {
  const h = date.getHours() % 12;
  const m = date.getMinutes();
  const s = date.getSeconds();
  const ms = date.getMilliseconds();
  const sec = s + ms / 1000;
  return {
    hour: (h + m / 60) * 30, // 360/12
    minute: (m + sec / 60) * 6, // 360/60
    second: sec * 6,
  };
}

/** 日期子表盘指针角度：一个月按 31 天计，1 号在 0 度，每天转 360/31 度（机械表常见 31 日刻度环） */
export function dateSubDialAngle(date: Date): number {
  return ((date.getDate() - 1) / 31) * 360;
}

/** 星期子表盘指针角度：周日=0，每天转 360/7 度 */
export function weekdaySubDialAngle(date: Date): number {
  return (date.getDay() / 7) * 360;
}
