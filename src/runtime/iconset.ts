/**
 * SnoozePanel 自定义图标集（HA 侧边栏品牌图标）。
 *
 * HA 原生侧边栏图标仅支持 mdi，无法直接使用自绘 Logo；
 * 这里按官方前端图标集机制注册一个自定义前缀 `snoozepanel`：
 *   window.customIconsets['snoozepanel'] = getIcon  → 返回 { path, viewBox }
 * 之后即可在 panel_custom 中以 `snoozepanel:logo` 作为侧边栏图标。
 *
 * 约束：图标集为单色（HA 按主题着色），故这里只放单路径、方形 viewBox 的
 * 单色字形；彩色品牌标见仓库 img/logo.svg（dev 页 / README / favicon 用）。
 * 纯注册逻辑，无副作用、无任何外发请求。
 */

/** 图标集前缀（与 __init__.py 中 sidebar_icon 的 `snoozepanel:` 对应） */
const ICON_SET_PREFIX = 'snoozepanel';

/** 统一 viewBox（方形，符合 HA 图标集要求） */
const ICON_VIEW_BOX = '0 0 24 24';

/** 单色单路径字形：一枚卧月 + 一点星芒，呼应「屏保 / 休眠」意象 */
const SNOOZE_ICON_PATH =
  'M12 2A10 10 0 0 0 22 12A8 8 0 0 1 12 2Z' +
  'M19.5 2.2L20.5 3.7L22 4.5L20.5 5.3L19.5 6.8L18.5 5.3L17 4.5L18.5 3.7Z';

/** 图标清单：名称 -> 路径数据 */
const ICONS: Record<string, string> = {
  logo: SNOOZE_ICON_PATH,
};

/** HA 图标集约定的单图标返回结构 */
interface IconDef {
  path: string;
  viewBox: string;
}

/** HA 图标集 getIcon 签名（不存在时返回空串） */
type IconGetter = (name: string) => Promise<IconDef | ''>;

/** 图标清单项 */
interface IconListItem {
  name: string;
}

/** 扩展 window：HA 前端图标集挂载点 */
interface WindowWithIcons {
  customIconsets?: Record<string, IconGetter>;
  customIcons?: Record<string, { getIcon: IconGetter; getIconList: () => Promise<IconListItem[]> }>;
}

/**
 * 注册 SnoozePanel 自定义图标集。
 *
 * 由 src/main.ts 在产物加载时调用；该 bundle 既被 HA 作为资源加载、
 * 又是 panel_custom 的 module_url，故加载即在 HA 前端注册图标集。
 * 若目标 HA 未加载本图标集，可把 __init__.py 的 sidebar_icon 回退为 mdi:power-sleep。
 */
export function registerSnoozeIconSet(): void {
  const w = window as unknown as WindowWithIcons;

  const getIcon: IconGetter = async (name) => {
    const path = ICONS[name];
    if (!path) return '';
    return { path, viewBox: ICON_VIEW_BOX };
  };

  const getIconList = async (): Promise<IconListItem[]> =>
    Object.keys(ICONS).map((name) => ({ name }));

  w.customIconsets = w.customIconsets || {};
  w.customIconsets[ICON_SET_PREFIX] = getIcon;

  w.customIcons = w.customIcons || {};
  w.customIcons[ICON_SET_PREFIX] = { getIcon, getIconList };
}
