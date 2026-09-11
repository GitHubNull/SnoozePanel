import { describe, it, expect } from 'vitest';
import { formatDate, isoWeekNumber, buildCalendarGrid, weekdayHeaders, formatClock } from '../core/clock';

describe('formatDate 日期格式模板', () => {
  const d = new Date(2026, 8, 11, 15, 30, 45); // 2026-09-11 周五

  it('常用占位符', () => {
    expect(formatDate(d, 'YYYY年M月D日')).toBe('2026年9月11日');
    expect(formatDate(d, 'YYYY-MM-DD')).toBe('2026-09-11');
  });

  it('星期占位符', () => {
    expect(formatDate(d, 'dddd')).toBe('周五');
    expect(formatDate(d, 'ddd')).toBe('五');
  });

  it('组合模板', () => {
    expect(formatDate(d, 'M月D日 dddd')).toBe('9月11日 周五');
  });
});

describe('isoWeekNumber ISO 周数', () => {
  it('2026-01-01 是 2026 第 1 周', () => {
    expect(isoWeekNumber(new Date(2026, 0, 1))).toBe(1);
  });

  it('已知锚点 2024-01-01 是 2024 第 1 周', () => {
    expect(isoWeekNumber(new Date(2024, 0, 1))).toBe(1);
  });

  it('跨年边界 2020-12-31 属 2020 第 53 周', () => {
    expect(isoWeekNumber(new Date(2020, 11, 31))).toBe(53);
  });
});

describe('buildCalendarGrid 月历网格', () => {
  it('固定 6 行 7 列', () => {
    const grid = buildCalendarGrid(2026, 8, 1);
    expect(grid).toHaveLength(6);
    grid.forEach((row) => expect(row).toHaveLength(7));
  });

  it('周一起始时 2026-09-01(周二) 在第一行第二列', () => {
    const grid = buildCalendarGrid(2026, 8, 1);
    // 第一列应为 8-31(周一)
    expect(grid[0][0].date.getDate()).toBe(31);
    expect(grid[0][0].inCurrentMonth).toBe(false);
    // 9-1 周二在第一行第二列
    expect(grid[0][1].date.getDate()).toBe(1);
    expect(grid[0][1].inCurrentMonth).toBe(true);
  });

  it('周日起始时 2026-09-01(周二) 在第一行第三列', () => {
    const grid = buildCalendarGrid(2026, 8, 0);
    expect(grid[0][2].date.getDate()).toBe(1);
    expect(grid[0][2].inCurrentMonth).toBe(true);
  });
});

describe('weekdayHeaders 周表头', () => {
  it('周一起始', () => {
    expect(weekdayHeaders(1)).toEqual(['一', '二', '三', '四', '五', '六', '日']);
  });
  it('周日起始', () => {
    expect(weekdayHeaders(0)).toEqual(['日', '一', '二', '三', '四', '五', '六']);
  });
});

describe('formatClock 数字时钟', () => {
  const d = new Date(2026, 8, 11, 15, 5, 9);

  it('24 小时制不带秒', () => {
    expect(formatClock(d, true, false)).toEqual({ main: '15:05', period: '' });
  });

  it('24 小时制带秒', () => {
    expect(formatClock(d, true, true)).toEqual({ main: '15:05:09', period: '' });
  });

  it('12 小时制下午', () => {
    expect(formatClock(d, false, false)).toEqual({ main: '03:05', period: 'PM' });
  });

  it('12 小时制午夜 0 点显示 12', () => {
    const midnight = new Date(2026, 8, 11, 0, 0, 0);
    expect(formatClock(midnight, false, false)).toEqual({ main: '12:00', period: 'AM' });
  });

  it('12 小时制正午 12 点显示 12 PM', () => {
    const noon = new Date(2026, 8, 11, 12, 0, 0);
    expect(formatClock(noon, false, false)).toEqual({ main: '12:00', period: 'PM' });
  });
});
