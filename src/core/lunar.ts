/**
 * 农历换算（自包含实现，内置 1900-2100 年数据表，零第三方依赖）。
 *
 * 数据表编码：每年一个 32 位整数
 *   bit  0-3 : 闰月月份（0 表示无闰月）
 *   bit  4-15: 1-12 月大小（1=大月30天, 0=小月29天）
 *   bit 16   : 闰月大小（1=大30, 0=小29）
 *   bit 20-23: 该年正月初一对应的公历月
 *   bit 24-29: 该年正月初一对应的公历日
 *
 * 数据来源于公开农历算法标准表（1900-2100）。
 */

const LUNAR_INFO: number[] = [
  0x04bd8, 0x04ae0, 0x0a570, 0x054d5, 0x0d260, 0x0d950, 0x16554, 0x056a0, 0x09ad0, 0x055d2, // 1900-1909
  0x04ae0, 0x0a5b6, 0x0a4d0, 0x0d250, 0x1d255, 0x0b540, 0x0d6a0, 0x0ada2, 0x095b0, 0x14977, // 1910-1919
  0x04970, 0x0a4b0, 0x0b4b5, 0x06a50, 0x06d40, 0x1ab54, 0x02b60, 0x09570, 0x052f2, 0x04970, // 1920-1929
  0x06566, 0x0d4a0, 0x0ea50, 0x06e95, 0x05ad0, 0x02b60, 0x186e3, 0x092e0, 0x1c8d7, 0x0c950, // 1930-1939
  0x0d4a0, 0x1d8a6, 0x0b550, 0x056a0, 0x1a5b4, 0x025d0, 0x092d0, 0x0d2b2, 0x0a950, 0x0b557, // 1940-1949
  0x06ca0, 0x0b550, 0x15355, 0x04da0, 0x0a5b0, 0x14573, 0x052b0, 0x0a9a8, 0x0e950, 0x06aa0, // 1950-1959
  0x0aea6, 0x0ab50, 0x04b60, 0x0aae4, 0x0a570, 0x05260, 0x0f263, 0x0d950, 0x05b57, 0x056a0, // 1960-1969
  0x096d0, 0x04dd5, 0x04ad0, 0x0a4d0, 0x0d4d4, 0x0d250, 0x0d558, 0x0b540, 0x0b6a0, 0x195a6, // 1970-1979
  0x095b0, 0x049b0, 0x0a974, 0x0a4b0, 0x0b27a, 0x06a50, 0x06d40, 0x0af46, 0x0ab60, 0x09570, // 1980-1989
  0x04af5, 0x04970, 0x064b0, 0x074a3, 0x0ea50, 0x06b58, 0x055c0, 0x0ab60, 0x096d5, 0x092e0, // 1990-1999
  0x0c960, 0x0d954, 0x0d4a0, 0x0da50, 0x07552, 0x056a0, 0x0abb7, 0x025d0, 0x092d0, 0x0cab5, // 2000-2009
  0x0a950, 0x0b4a0, 0x0baa4, 0x0ad50, 0x055d9, 0x04ba0, 0x0a5b0, 0x15176, 0x052b0, 0x0a930, // 2010-2019
  0x07954, 0x06aa0, 0x0ad50, 0x05b52, 0x04b60, 0x0a6e6, 0x0a4e0, 0x0d260, 0x0ea65, 0x0d530, // 2020-2029
  0x05aa0, 0x076a3, 0x096d0, 0x04afb, 0x04ad0, 0x0a4d0, 0x1d0b6, 0x0d250, 0x0d520, 0x0dd45, // 2030-2039
  0x0b5a0, 0x056d0, 0x055b2, 0x049b0, 0x0a577, 0x0a4b0, 0x0aa50, 0x1b255, 0x06d20, 0x0ada0, // 2040-2049
  0x14b63, 0x09370, 0x049f8, 0x04970, 0x064b0, 0x168a6, 0x0ea50, 0x06b20, 0x1a6c4, 0x0aae0, // 2050-2059
  0x0a2e0, 0x0d2e3, 0x0c960, 0x0d557, 0x0d4a0, 0x0da50, 0x05d55, 0x056a0, 0x0a6d0, 0x055d4, // 2060-2069
  0x052d0, 0x0a9b8, 0x0a950, 0x0b4a0, 0x0b6a6, 0x0ad50, 0x055a0, 0x0aba4, 0x0a5b0, 0x052b0, // 2070-2079
  0x0b273, 0x06930, 0x07337, 0x06aa0, 0x0ad50, 0x14b55, 0x04b60, 0x0a570, 0x054e4, 0x0d160, // 2080-2089
  0x0e968, 0x0d520, 0x0daa0, 0x16aa6, 0x056d0, 0x04ae0, 0x0a9d4, 0x0a2d0, 0x0d150, 0x0f252, // 2090-2099
  0x0d520, // 2100
];

const MIN_YEAR = 1900;
const MAX_YEAR = 2100;

const MONTH_NAMES = ['正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '冬', '腊'];
const DAY_NAMES = [
  '初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
  '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
  '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十',
];
const GAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const ZODIAC = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'];

export interface LunarDate {
  year: number;          // 农历年
  month: number;         // 农历月 1-12
  day: number;           // 农历日 1-30
  isLeap: boolean;       // 是否闰月
  monthName: string;     // 如 "正月" "冬月"
  dayName: string;       // 如 "初一" "廿五"
  ganzhi: string;        // 年干支 如 "甲辰"
  zodiac: string;        // 生肖 如 "龙"
}

/** 闰月月份（0=无） */
function leapMonth(y: number): number {
  return LUNAR_INFO[y - MIN_YEAR] & 0xf;
}

/** 闰月天数 */
function leapDays(y: number): number {
  if (leapMonth(y) === 0) return 0;
  return (LUNAR_INFO[y - MIN_YEAR] & 0x10000) !== 0 ? 30 : 29;
}

/** 农历 y 年 m 月天数 */
function monthDays(y: number, m: number): number {
  return (LUNAR_INFO[y - MIN_YEAR] >> (16 - m)) & 0x1 ? 30 : 29;
}

/** 农历 y 年总天数 */
function yearDays(y: number): number {
  let sum = 348; // 12 个月 * 29 天
  for (let m = 1; m <= 12; m++) {
    if (monthDays(y, m) === 30) sum++;
  }
  return sum + leapDays(y);
}

/** 干支 */
function ganzhiOf(y: number): string {
  return GAN[(y - 4) % 10] + ZHI[(y - 4) % 12];
}

/** 生肖 */
function zodiacOf(y: number): string {
  return ZODIAC[(y - 4) % 12];
}

/**
 * 公历转农历。超出 1900-2100 范围返回 null。
 */
export function solarToLunar(date: Date): LunarDate | null {
  const y = date.getFullYear();
  if (y < MIN_YEAR || y > MAX_YEAR) return null;

  // 以 1900-01-31（农历 1900 年正月初一）为基准的偏移天数
  const base = Date.UTC(1900, 0, 31);
  const target = Date.UTC(y, date.getMonth(), date.getDate());
  let offset = Math.floor((target - base) / 86400000);
  if (offset < 0) return null;

  let lunarYear = MIN_YEAR;
  while (lunarYear <= MAX_YEAR) {
    const daysOfYear = yearDays(lunarYear);
    if (offset < daysOfYear) break;
    offset -= daysOfYear;
    lunarYear++;
  }
  if (lunarYear > MAX_YEAR) return null;

  const leap = leapMonth(lunarYear);
  let isLeap = false;
  let lunarMonth = 1;

  // 依次经过 1..12 月；当存在闰月且走到 leap+1 月之前，先扣除闰月
  let m = 1;
  while (m <= 12) {
    // 若本月之后紧跟着闰月（即当前 m == leap+1 且尚未处理闰月），先处理闰月
    if (leap > 0 && m === leap + 1) {
      const ld = leapDays(lunarYear);
      if (offset < ld) {
        isLeap = true;
        lunarMonth = leap;
        break;
      }
      offset -= ld;
      // 闰月已扣除，后续从 leap+1 月继续正常月份
    }

    const md = monthDays(lunarYear, m);
    if (offset < md) {
      lunarMonth = m;
      break;
    }
    offset -= md;
    m++;
  }

  const lunarDay = offset + 1;
  const monthName = (isLeap ? '闰' : '') + MONTH_NAMES[lunarMonth - 1] + '月';
  const dayName = DAY_NAMES[lunarDay - 1] ?? String(lunarDay);

  return {
    year: lunarYear,
    month: lunarMonth,
    day: lunarDay,
    isLeap,
    monthName,
    dayName,
    ganzhi: ganzhiOf(lunarYear),
    zodiac: zodiacOf(lunarYear),
  };
}

/**
 * 按格式模板渲染农历。支持占位符：
 *   {lunar_month} 农历月名（含闰）  {lunar_day} 农历日名
 *   {ganzhi} 年干支  {zodiac} 生肖  {year} 农历年数字
 */
export function formatLunar(date: Date, format: string): string {
  const l = solarToLunar(date);
  if (!l) return '';
  return format
    .replace(/\{lunar_month\}/g, l.monthName)
    .replace(/\{lunar_day\}/g, l.dayName)
    .replace(/\{ganzhi\}/g, l.ganzhi)
    .replace(/\{zodiac\}/g, l.zodiac)
    .replace(/\{year\}/g, String(l.year));
}
