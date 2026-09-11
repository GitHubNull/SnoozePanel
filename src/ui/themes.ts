/**
 * 内置主题。两套：midnight（深色）/ paper（浅色宣纸）。
 * 主题为 CSS 变量集合，屏保根组件按主题应用。
 */

export interface Theme {
  name: string;
  /** 主文字色 */
  text: string;
  /** 次要文字色（日历/农历/标签） */
  textSecondary: string;
  /** 强调色（今天高亮、秒针等） */
  accent: string;
  /** 时钟数字字体粗细 */
  clockWeight: number;
  /** 字体族 */
  fontFamily: string;
}

export const THEMES: Record<'midnight' | 'paper', Theme> = {
  midnight: {
    name: '深夜',
    text: '#eef2f8',
    textSecondary: 'rgba(238, 242, 248, 0.62)',
    accent: '#5ea0ff',
    clockWeight: 200,
    fontFamily: '"Segoe UI", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif',
  },
  paper: {
    name: '宣纸',
    text: '#2b2620',
    textSecondary: 'rgba(43, 38, 32, 0.6)',
    accent: '#b3543a',
    clockWeight: 300,
    fontFamily: '"PingFang SC", "Microsoft YaHei", "Segoe UI", system-ui, sans-serif',
  },
};

export function getTheme(name: string): Theme {
  return name === 'paper' ? THEMES.paper : THEMES.midnight;
}
