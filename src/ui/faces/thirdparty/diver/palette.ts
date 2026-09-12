/**
 * 潜水表调色板：按主题键派生钢/陶瓷/夜光配色。
 *
 * 第三方表盘应通过 theme.key 可靠区分主题（午夜 = 冷钢 + 高亮夜光；
 * 宣纸 = 暖钢 + 收敛夜光），从而在两种主题下均保证高水准呈现。
 */

export type DiverPalette = {
  /** 表圈陶瓷外缘 */
  bezelOuter: string;
  /** 表圈陶瓷内缘 */
  bezelInner: string;
  /** 表圈镜面高光 */
  bezelGloss: string;
  /** 表圈倒角描边 */
  bezelEdge: string;
  /** 钢壳高光 */
  steelLight: string;
  /** 钢壳中间调 */
  steelMid: string;
  /** 钢壳暗部 */
  steelDark: string;
  /** 表盘主色 */
  dial: string;
  /** 表盘边缘 */
  dialEdge: string;
  /** 夜光主色 */
  lume: string;
  /** 夜光弱化色（刻度内嵌） */
  lumeDim: string;
  /** 夜光外晕色 */
  lumeGlow: string;
  /** 表盘文字 */
  text: string;
  /** 表盘次要文字 */
  textDim: string;
  /** 刻度钢色 */
  markerInk: string;
  /** 秒针强调色 */
  accent: string;
  /** 整体落影 */
  shadow: string;
};

/** 按主题键生成调色板 */
export function diverPalette(key: 'midnight' | 'paper'): DiverPalette {
  if (key === 'paper') {
    return {
      bezelOuter: '#2b3138',
      bezelInner: '#14171b',
      bezelGloss: 'rgba(255, 255, 255, 0.20)',
      bezelEdge: '#0a0c0f',
      steelLight: '#d9dfe4',
      steelMid: '#aab2b9',
      steelDark: '#6b737a',
      dial: '#12161b',
      dialEdge: '#07090c',
      lume: '#e9dfc0',
      lumeDim: 'rgba(233, 223, 192, 0.5)',
      lumeGlow: 'rgba(190, 225, 255, 0.08)',
      text: '#e9edf1',
      textDim: 'rgba(233, 237, 241, 0.6)',
      markerInk: '#d9dfe4',
      accent: '#e8734a',
      shadow: 'rgba(60, 45, 30, 0.35)',
    };
  }
  return {
    bezelOuter: '#1d2229',
    bezelInner: '#0c0f12',
    bezelGloss: 'rgba(255, 255, 255, 0.24)',
    bezelEdge: '#040508',
    steelLight: '#ccd5dd',
    steelMid: '#98a3ad',
    steelDark: '#5b636b',
    dial: '#090c10',
    dialEdge: '#030508',
    lume: '#bdf6e6',
    lumeDim: 'rgba(189, 246, 230, 0.55)',
    lumeGlow: 'rgba(120, 225, 255, 0.18)',
    text: '#e6ecf2',
    textDim: 'rgba(230, 236, 242, 0.58)',
    markerInk: '#ccd5dd',
    accent: '#ff6b3d',
    shadow: 'rgba(0, 0, 0, 0.5)',
  };
}
