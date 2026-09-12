/**
 * 编辑器「选中组件」状态与派生数据。
 *
 * 承载五区中左右面板与画布共享的选中态：
 *   - 组件清单（四类固定组件 + 每条自定义文本各成一项）与选中项中文名；
 *   - 组件显隐开关、新增/删除自定义文本；
 *   - 当前选中组件对应的 layout / color（读写草稿）与画布拖拽回写。
 * 所有读写都作用于传入的草稿对象（reactive），本模块不自持副本。
 */
import { computed, ref, type ComputedRef, type Ref, type WritableComputedRef } from 'vue';
import { DEFAULT_LAYOUTS, type ComponentLayout, type SnoozeConfig } from '@/core/types';
import { attachHexHash } from '@/core/config';

/** 组件清单单项 */
interface ComponentListItem {
  key: string;
  label: string;
  show: boolean;
  toggleable: boolean;
}

/** 编辑器选中态组合式函数返回值 */
export interface ComponentSelection {
  selectedComponent: Ref<string>;
  componentList: ComputedRef<ComponentListItem[]>;
  selectedLabel: ComputedRef<string>;
  setComponentShow: (key: string, value: boolean) => void;
  addText: () => void;
  selectedTextIndex: ComputedRef<number>;
  selectedTextContent: WritableComputedRef<string>;
  selectedTextShow: WritableComputedRef<boolean>;
  removeSelectedText: () => void;
  onCanvasSelect: (compKey: string) => void;
  currentLayout: WritableComputedRef<ComponentLayout>;
  currentColor: WritableComputedRef<string>;
  setCurrentColor: (v: string) => void;
  updateComponentLayout: (compKey: string, layout: ComponentLayout) => void;
}

/**
 * 创建选中态与派生数据。
 * @param draft 编辑草稿（reactive）
 */
export function useComponentSelection(draft: SnoozeConfig): ComponentSelection {
  /** 当前选中组件 key（clock / calendar / lunar / weather / text_N） */
  const selectedComponent = ref<string>('clock');

  /** 组件分类清单（四类固定组件 + 每条自定义文本各成一项） */
  const componentList = computed<ComponentListItem[]>(() => {
    const list: ComponentListItem[] = [
      { key: 'clock', label: '时钟', show: draft.components.clock.show, toggleable: true },
      { key: 'calendar', label: '日历', show: draft.components.calendar.show, toggleable: true },
      { key: 'lunar', label: '农历', show: draft.components.lunar.show, toggleable: true },
      { key: 'weather', label: '天气', show: draft.components.weather.show, toggleable: true },
    ];
    // 每条自定义文本在列表中单独列出并各带显隐开关（复用 per-text 的 show 字段）；
    // 标签取文本内容（空则「文本 N」），使「室温 …」这类项一眼可辨。
    draft.components.texts.forEach((t, i) => {
      list.push({
        key: `text_${i}`,
        label: t.content.trim() || `文本 ${i + 1}`,
        show: t.show !== false,
        toggleable: true,
      });
    });
    return list;
  });

  /** 当前选中组件的中文名（右侧属性面板标题 / 状态栏提示） */
  const selectedLabel = computed(
    () => componentList.value.find((c) => c.key === selectedComponent.value)?.label ?? '',
  );

  /** 组件显隐开关（clock/calendar/lunar/weather，以及每条自定义文本 text_N） */
  function setComponentShow(key: string, value: boolean): void {
    switch (key) {
      case 'clock': draft.components.clock.show = value; break;
      case 'calendar': draft.components.calendar.show = value; break;
      case 'lunar': draft.components.lunar.show = value; break;
      case 'weather': draft.components.weather.show = value; break;
      default:
        // 单条自定义文本（text_0 / text_1 …）
        if (key.startsWith('text_')) {
          const idx = Number(key.slice(5));
          if (draft.components.texts[idx]) draft.components.texts[idx].show = value;
        }
    }
  }

  /** 新增一条自定义文本并立即选中（右侧随即出现该条文本的属性） */
  function addText(): void {
    draft.components.texts.push({ content: '', layout: { ...DEFAULT_LAYOUTS.text }, show: true });
    selectedComponent.value = `text_${draft.components.texts.length - 1}`;
  }

  /** 当前选中的单条自定义文本下标（未选中文本时返回 -1） */
  const selectedTextIndex = computed(() => {
    if (!selectedComponent.value.startsWith('text_')) return -1;
    const idx = Number(selectedComponent.value.slice(5));
    return draft.components.texts[idx] ? idx : -1;
  });

  /** 当前选中单条文本的内容（供属性面板直接编辑；未选中文本时返回空串） */
  const selectedTextContent = computed<string>({
    get: () => {
      const i = selectedTextIndex.value;
      return i >= 0 ? draft.components.texts[i].content : '';
    },
    set: (v: string) => {
      const i = selectedTextIndex.value;
      if (i >= 0) draft.components.texts[i].content = v;
    },
  });

  /** 当前选中单条文本的显隐（供属性面板开关） */
  const selectedTextShow = computed<boolean>({
    get: () => {
      const i = selectedTextIndex.value;
      return i >= 0 ? draft.components.texts[i].show !== false : true;
    },
    set: (v: boolean) => {
      const i = selectedTextIndex.value;
      if (i >= 0) draft.components.texts[i].show = v;
    },
  });

  /** 删除当前选中的自定义文本（选中态回退到时钟） */
  function removeSelectedText(): void {
    const idx = selectedTextIndex.value;
    if (idx < 0) return;
    draft.components.texts.splice(idx, 1);
    selectedComponent.value = 'clock';
  }

  /** 画布点选组件 → 左侧分类与右侧属性同步切换 */
  function onCanvasSelect(compKey: string): void {
    selectedComponent.value = compKey;
  }

  /** 当前选中组件的 layout */
  const currentLayout = computed<ComponentLayout>({
    get: () => {
      if (selectedComponent.value.startsWith('text_')) {
        const text = draft.components.texts[Number(selectedComponent.value.slice(5))];
        if (text) return text.layout;
      }
      switch (selectedComponent.value) {
        case 'clock': return draft.components.clock.layout;
        case 'calendar': return draft.components.calendar.layout;
        case 'lunar': return draft.components.lunar.layout;
        case 'weather': return draft.components.weather.layout;
        default: return draft.components.clock.layout;
      }
    },
    set: (v) => {
      if (selectedComponent.value.startsWith('text_')) {
        const text = draft.components.texts[Number(selectedComponent.value.slice(5))];
        if (text) text.layout = v;
        return;
      }
      switch (selectedComponent.value) {
        case 'clock': draft.components.clock.layout = v; break;
        case 'calendar': draft.components.calendar.layout = v; break;
        case 'lunar': draft.components.lunar.layout = v; break;
        case 'weather': draft.components.weather.layout = v; break;
      }
    },
  });

  /** 当前选中组件的 color */
  const currentColor = computed<string>({
    get: () => {
      if (selectedComponent.value.startsWith('text_')) {
        return draft.components.texts[Number(selectedComponent.value.slice(5))]?.color ?? '';
      }
      switch (selectedComponent.value) {
        case 'clock': return draft.components.clock.color ?? '';
        case 'calendar': return draft.components.calendar.color ?? '';
        case 'lunar': return draft.components.lunar.color ?? '';
        case 'weather': return draft.components.weather.color ?? '';
        default: return '';
      }
    },
    set: (v) => {
      const val = v || undefined;
      if (selectedComponent.value.startsWith('text_')) {
        const text = draft.components.texts[Number(selectedComponent.value.slice(5))];
        if (text) text.color = val;
        return;
      }
      switch (selectedComponent.value) {
        case 'clock': draft.components.clock.color = val; break;
        case 'calendar': draft.components.calendar.color = val; break;
        case 'lunar': draft.components.lunar.color = val; break;
        case 'weather': draft.components.weather.color = val; break;
      }
    },
  });

  function setCurrentColor(v: string): void {
    // ColorPicker（format=hex）输出不带 '#' 的裸 hex（如 175cd4），补 '#' 后才是合法 CSS；
    // 否则配置层 normalizeColor 会判为非法而丢弃，表现为「改不了颜色」。
    currentColor.value = attachHexHash(String(v ?? ''));
  }

  /** 更新指定组件的 layout（数字输入直接绑定 draft，此处供预览画布拖拽回写） */
  function updateComponentLayout(compKey: string, layout: ComponentLayout): void {
    if (compKey === 'clock') {
      draft.components.clock.layout = layout;
    } else if (compKey === 'calendar') {
      draft.components.calendar.layout = layout;
    } else if (compKey === 'lunar') {
      draft.components.lunar.layout = layout;
    } else if (compKey === 'weather') {
      draft.components.weather.layout = layout;
    } else if (compKey.startsWith('text_')) {
      const idx = Number(compKey.slice(5));
      if (draft.components.texts[idx]) {
        draft.components.texts[idx].layout = layout;
      }
    }
  }

  return {
    selectedComponent,
    componentList,
    selectedLabel,
    setComponentShow,
    addText,
    selectedTextIndex,
    selectedTextContent,
    selectedTextShow,
    removeSelectedText,
    onCanvasSelect,
    currentLayout,
    currentColor,
    setCurrentColor,
    updateComponentLayout,
  };
}
