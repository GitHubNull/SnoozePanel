/**
 * 编辑器 UI 偏好：面板宽度 / 收起态 / 画布网格的读取、clamp、拖拽、恢复默认与持久化。
 *
 * 设计约束：
 *   - 仅承载 UI 偏好，绝不承载插件配置（配置持久化必须走 HA 后端，见 doc/TODO.md）；
 *   - 单一 localStorage key，唯一读写者即本模块，避免多处写同一键互相覆盖；
 *   - 任何异常（隐私模式 / 数据损坏 / 字段缺失）都静默回默认值，不影响编辑器可用性；
 *   - 窄宿主（HA 卡片编辑弹窗等）自动收起左右面板，但用户手动调整后不再干预。
 */
import { computed, reactive, ref, watch } from 'vue';

/** 侧栏面板标识 */
export type PanelKey = 'cats' | 'props';

/** 单个侧栏面板状态 */
export interface PanelState {
  /** 展开态宽度（px） */
  w: number;
  /** 用户手动收起 */
  collapsed: boolean;
}

/** 画布网格与磁吸附偏好 */
export interface GridState {
  show: boolean;
  snap: boolean;
  /** 网格步长（百分比，1-20） */
  step: number;
}

/** 编辑器 UI 偏好全量 */
export interface EditorLayoutState {
  menuCollapsed: boolean;
  cats: PanelState;
  props: PanelState;
  grid: GridState;
}

/** localStorage 键（仅 UI 偏好） */
export const PLUGIN_LAYOUT_KEY = 'snoozepanel.plugin.layout';

/** 默认值（首次使用 / 恢复默认 / 数据损坏兜底） */
export const DEFAULT_EDITOR_LAYOUT: EditorLayoutState = {
  menuCollapsed: false,
  cats: { w: 260, collapsed: false },
  props: { w: 340, collapsed: false },
  grid: { show: true, snap: true, step: 5 },
};

/** 面板宽度约束（px） */
export const PANEL_LIMITS: Record<PanelKey, { min: number; max: number }> = {
  cats: { min: 200, max: 480 },
  props: { min: 260, max: 620 },
};

/** 画布最小宽度（px）：两侧面板拖宽不得把画布挤没 */
export const CANVAS_MIN_WIDTH = 320;
/** 收起后的滑轨宽度（px） */
export const RAIL_WIDTH = 36;
/** 网格步长可调范围（百分比） */
export const GRID_STEP_LIMITS = { min: 1, max: 20 };
/** 网格尺寸预设档位（百分比） */
export const GRID_STEP_PRESETS = [1, 2, 5, 10];
/** 窄宿主阈值（px）：内容宽低于此值时自动收起左右面板 */
export const NARROW_HOST_WIDTH = 900;

/** 数值收敛：非法值回退 fallback，合法值裁剪到 [min, max] */
export function clampNum(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/** 深拷贝默认值（避免调用方修改默认常量） */
function cloneDefault(): EditorLayoutState {
  return JSON.parse(JSON.stringify(DEFAULT_EDITOR_LAYOUT)) as EditorLayoutState;
}

/** 读取本地偏好（异常/缺失/损坏一律回默认值） */
function loadLayout(): EditorLayoutState {
  const fallback = cloneDefault();
  try {
    const raw = window.localStorage.getItem(PLUGIN_LAYOUT_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<EditorLayoutState> | null;
    if (!parsed || typeof parsed !== 'object') return fallback;
    return {
      menuCollapsed: parsed.menuCollapsed === true,
      cats: {
        w: clampNum(parsed.cats?.w, PANEL_LIMITS.cats.min, PANEL_LIMITS.cats.max, fallback.cats.w),
        collapsed: parsed.cats?.collapsed === true,
      },
      props: {
        w: clampNum(parsed.props?.w, PANEL_LIMITS.props.min, PANEL_LIMITS.props.max, fallback.props.w),
        collapsed: parsed.props?.collapsed === true,
      },
      grid: {
        // 网格默认开启：缺省或非 false 均视为开启
        show: parsed.grid?.show !== false,
        snap: parsed.grid?.snap !== false,
        step: clampNum(parsed.grid?.step, GRID_STEP_LIMITS.min, GRID_STEP_LIMITS.max, fallback.grid.step),
      },
    };
  } catch {
    return fallback;
  }
}

/**
 * 编辑器 UI 偏好组合式函数。
 * 返回值中的尺寸/状态可直接绑定到模板，动作函数用于交互。
 */
export function useEditorLayout() {
  const layout = reactive<EditorLayoutState>(loadLayout());
  /** 窄宿主（自动收起左右面板；用户手动调整后置为 false 并不再自动生效） */
  const narrow = ref(false);
  /** 用户是否手动调整过面板（一旦手动，宿主宽度变化不再自动干预） */
  let manualOverride = false;

  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  function persist(): void {
    if (saveTimer !== null) clearTimeout(saveTimer);
    // 防抖落盘：拖拽过程中不逐帧写 localStorage
    saveTimer = setTimeout(() => {
      saveTimer = null;
      try {
        window.localStorage.setItem(PLUGIN_LAYOUT_KEY, JSON.stringify(layout));
      } catch {
        // 隐私模式 / 配额不足：忽略，不影响编辑器使用
      }
    }, 200);
  }

  watch(layout, persist, { deep: true });

  /** 有效收起态：手动收起 或 窄宿主自动收起 */
  const catsCollapsed = computed(() => layout.cats.collapsed || narrow.value);
  const propsCollapsed = computed(() => layout.props.collapsed || narrow.value);

  /** 面板实际宽度（px，收起时退化为滑轨宽度） */
  const catsWidth = computed(() => (catsCollapsed.value ? RAIL_WIDTH : layout.cats.w));
  const propsWidth = computed(() => (propsCollapsed.value ? RAIL_WIDTH : layout.props.w));

  /** 传给画布的网格偏好（只读快照） */
  const canvasGrid = computed<GridState>(() => ({
    show: layout.grid.show,
    snap: layout.grid.snap,
    step: layout.grid.step,
  }));

  /** 标记用户已手动调整（此后宿主宽度变化不再自动收起/展开） */
  function markManual(): void {
    manualOverride = true;
  }

  /**
   * 宿主宽度自适应：窄宿主自动收起左右面板。
   * 用户手动调整过后不再干预，避免与用户意图打架。
   */
  function applyHostWidth(hostWidth: number): void {
    if (manualOverride) return;
    narrow.value = hostWidth > 0 && hostWidth < NARROW_HOST_WIDTH;
  }

  /**
   * 按宿主宽度收敛面板宽度：保证画布至少保留 CANVAS_MIN_WIDTH。
   * 窗口变窄时调用，避免存储的旧宽度把画布挤没。
   */
  function clampToHost(hostWidth: number): void {
    if (hostWidth <= 0) return;
    const maxCats = Math.min(
      PANEL_LIMITS.cats.max,
      Math.max(PANEL_LIMITS.cats.min, hostWidth - layout.props.w - CANVAS_MIN_WIDTH),
    );
    layout.cats.w = Math.min(layout.cats.w, maxCats);
    const maxProps = Math.min(
      PANEL_LIMITS.props.max,
      Math.max(PANEL_LIMITS.props.min, hostWidth - layout.cats.w - CANVAS_MIN_WIDTH),
    );
    layout.props.w = Math.min(layout.props.w, maxProps);
  }

  /** 拖拽调整某个面板的宽度（pointer 事件 + 全局 resizing 类） */
  function startResize(which: PanelKey, ev: PointerEvent, hostEl: HTMLElement): void {
    if (ev.button !== 0) return;
    ev.preventDefault();
    markManual();
    const limits = PANEL_LIMITS[which];
    const startX = ev.clientX;
    const startW = which === 'cats' ? layout.cats.w : layout.props.w;

    const maxAllowed = (): number => {
      const hostW = hostEl.getBoundingClientRect().width;
      const otherW = which === 'cats' ? propsWidth.value : catsWidth.value;
      return Math.max(limits.min, Math.min(limits.max, hostW - otherW - CANVAS_MIN_WIDTH));
    };

    const onMove = (e: PointerEvent): void => {
      const delta = which === 'cats' ? e.clientX - startX : startX - e.clientX;
      const next = clampNum(startW + delta, limits.min, maxAllowed(), startW);
      if (which === 'cats') layout.cats.w = next;
      else layout.props.w = next;
    };
    const onUp = (): void => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      document.documentElement.classList.remove('sp-editor-resizing');
    };

    document.documentElement.classList.add('sp-editor-resizing');
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  }

  /** 收起 / 展开面板（展开时清除窄宿主自动收起，尊重用户意图） */
  function togglePanel(which: PanelKey): void {
    markManual();
    const collapsed = which === 'cats' ? catsCollapsed.value : propsCollapsed.value;
    if (collapsed) {
      narrow.value = false;
      if (which === 'cats') layout.cats.collapsed = false;
      else layout.props.collapsed = false;
      return;
    }
    if (which === 'cats') layout.cats.collapsed = true;
    else layout.props.collapsed = true;
  }

  /** 恢复某面板默认宽度（保持展开态，并清除窄宿主自动收起） */
  function restorePanelWidth(which: PanelKey): void {
    markManual();
    narrow.value = false;
    if (which === 'cats') {
      layout.cats.w = DEFAULT_EDITOR_LAYOUT.cats.w;
      layout.cats.collapsed = false;
    } else {
      layout.props.w = DEFAULT_EDITOR_LAYOUT.props.w;
      layout.props.collapsed = false;
    }
  }

  /** 收起 / 展开插件菜单栏 */
  function toggleMenu(): void {
    layout.menuCollapsed = !layout.menuCollapsed;
  }

  /** 设置网格步长（裁剪到 [1, 20]%） */
  function setGridStep(step: number): void {
    layout.grid.step = clampNum(step, GRID_STEP_LIMITS.min, GRID_STEP_LIMITS.max, DEFAULT_EDITOR_LAYOUT.grid.step);
  }

  /** 恢复网格默认（显示开 / 磁吸开 / 步长 5%） */
  function resetGrid(): void {
    layout.grid.show = DEFAULT_EDITOR_LAYOUT.grid.show;
    layout.grid.snap = DEFAULT_EDITOR_LAYOUT.grid.snap;
    layout.grid.step = DEFAULT_EDITOR_LAYOUT.grid.step;
  }

  return {
    layout,
    catsCollapsed,
    propsCollapsed,
    catsWidth,
    propsWidth,
    canvasGrid,
    applyHostWidth,
    clampToHost,
    startResize,
    togglePanel,
    restorePanelWidth,
    toggleMenu,
    setGridStep,
    resetGrid,
  };
}
