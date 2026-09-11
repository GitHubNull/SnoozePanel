import { describe, it, expect } from 'vitest';
import { solarToLunar, formatLunar } from '../core/lunar';

describe('solarToLunar 农历换算', () => {
  it('2000-01-01 → 农历 1999 年冬月廿五', () => {
    const l = solarToLunar(new Date(2000, 0, 1));
    expect(l).not.toBeNull();
    expect(l!.year).toBe(1999);
    expect(l!.month).toBe(11);
    expect(l!.day).toBe(25);
    expect(l!.monthName).toBe('冬月');
    expect(l!.dayName).toBe('廿五');
    expect(l!.isLeap).toBe(false);
  });

  it('2024-02-10 → 农历 2024 年正月初一（春节）', () => {
    const l = solarToLunar(new Date(2024, 1, 10));
    expect(l).not.toBeNull();
    expect(l!.year).toBe(2024);
    expect(l!.month).toBe(1);
    expect(l!.day).toBe(1);
    expect(l!.monthName).toBe('正月');
    expect(l!.dayName).toBe('初一');
    expect(l!.ganzhi).toBe('甲辰');
    expect(l!.zodiac).toBe('龙');
  });

  it('2023-01-22 → 农历 2023 年正月初一（春节）', () => {
    const l = solarToLunar(new Date(2023, 0, 22));
    expect(l!.year).toBe(2023);
    expect(l!.month).toBe(1);
    expect(l!.day).toBe(1);
    expect(l!.ganzhi).toBe('癸卯');
    expect(l!.zodiac).toBe('兔');
  });

  it('2023-03-22 → 农历 2023 年闰二月初一（闰月）', () => {
    // 2023 年闰二月
    const l = solarToLunar(new Date(2023, 2, 22));
    expect(l).not.toBeNull();
    expect(l!.month).toBe(2);
    expect(l!.isLeap).toBe(true);
    expect(l!.monthName).toBe('闰二月');
  });

  it('2023-02-20 → 农历 2023 年二月初一（非闰）', () => {
    const l = solarToLunar(new Date(2023, 1, 20));
    expect(l!.month).toBe(2);
    expect(l!.isLeap).toBe(false);
    expect(l!.day).toBe(1);
  });

  it('边界：1900-01-31 → 农历 1900 年正月初一', () => {
    const l = solarToLunar(new Date(1900, 0, 31));
    expect(l).not.toBeNull();
    expect(l!.year).toBe(1900);
    expect(l!.month).toBe(1);
    expect(l!.day).toBe(1);
  });

  it('边界：1900-01-30 超出范围返回 null', () => {
    expect(solarToLunar(new Date(1900, 0, 30))).toBeNull();
  });

  it('边界：2101 年超出范围返回 null', () => {
    expect(solarToLunar(new Date(2101, 0, 1))).toBeNull();
  });

  it('2025-01-29 → 农历 2025 年正月初一（春节）', () => {
    const l = solarToLunar(new Date(2025, 0, 29));
    expect(l!.year).toBe(2025);
    expect(l!.month).toBe(1);
    expect(l!.day).toBe(1);
    expect(l!.ganzhi).toBe('乙巳');
    expect(l!.zodiac).toBe('蛇');
  });
});

describe('formatLunar 农历格式化', () => {
  it('默认占位符替换', () => {
    const s = formatLunar(new Date(2024, 1, 10), '{lunar_month}{lunar_day}');
    expect(s).toBe('正月初一');
  });

  it('干支与生肖占位符', () => {
    const s = formatLunar(new Date(2024, 1, 10), '{ganzhi}{zodiac}年');
    expect(s).toBe('甲辰龙年');
  });

  it('超范围日期返回空串', () => {
    expect(formatLunar(new Date(2101, 0, 1), '{lunar_month}')).toBe('');
  });
});
