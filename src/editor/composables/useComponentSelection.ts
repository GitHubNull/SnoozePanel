/**
 * 编辑器「选中组件」状态与派生数据（支持多选）。
 *
 * 承载五区中左右面板与画布共享的选中态：
 *   - 选中集合 selectedKeys（支持 2+ 组件对齐/分布）；派生的 selectedComponent
 *     取「最后选中项」，供属性面板主体与状态栏复用；设值即退化为单选。
 *   - 组件清单（五类固定组件 + 每条自定义文本各成一项）与选中项中文名；
 *   - 组件显隐开关、新增/删除自定义文本；
 *   - 当前选中组件对应的 layout / color（读写草稿）与画布拖拽回写。
 * 所有读写都作用于传入的草稿对象（reactive），本模块不自持副本。
 */
import { computed, ref, type ComputedRef, type Ref, type WritableComputedRef } from 'vue';
import { DEFAULT_LAYOUTS, type ComponentLayout, type SnoozeConfig } from '@/core/types';
import { attachHexHash } from '@/core/config';
import { CLOCK_TYPE_SCHEMA, facesVersion, getFace } from '@/ui/faces/registry';
import { getWidgetSchema, widgetsVersion } from '@/ui/widgets/registry';
import type { PropertyField } from '@/ui/plugins/types';

/** 组件清单单项 */
interface ComponentListItem {
  key: string;
  label: string;
  show: boolean;
  toggleable: boolean;
}

/** 编辑器选中态组合式函数返回值 */
export interface ComponentSelection {
  /** 当前选中的全部组件 key（按选中先后顺序，末位为「主选中」） */
  selectedKeys: Ref<string[]>;
  /** 主选中组件 key（=最后选中项）；设值即单选该组件 */
  selectedComponent: Ref<string>;
  /** 选中数量 */
  selectedCount: ComputedRef<number>;
  componentList: ComputedRef<ComponentListItem[]>;
  selectedLabel: ComputedRef<string>;
  /** 判断某组件是否被选中 */
  isSelected: (key: string) => boolean;
  /** 单选（替换整个选中集） */
  selectOne: (key: string) => void;
  /** 增量切换某组件选中态（Ctrl/Cmd/Shift 多选） */
  toggleSelect: (key: string) => void;
  /** 批量设置选中集 */
  selectKeys: (keys: string[]) => void;
  /** 清空选中 */
  clearSelection: () => void;
  setComponentShow: (key: string, value: boolean) => void;
  addText: () => void;
  selectedTextIndex: ComputedRef<number>;
  selectedTextContent: WritableComputedRef<string>;
  selectedTextShow: WritableComputedRef<boolean>;
  removeSelectedText: () => void;
  /** 画布点选：additive=true 为增量多选，否则单选 */
  onCanvasSelect: (compKey: string, additive?: boolean) => void;
  currentLayout: WritableComputedRef<ComponentLayout>;
  currentColor: WritableComputedRef<string>;
  setCurrentColor: (v: string) => void;
  /** 主选中组件的属性 schema（表盘取 face.schema；widget 取样式级→类型级） */
  currentSchema: ComputedRef<PropertyField[]>;
  /** 主选中组件的 options 透传对象（读写 component.options） */
  currentOptions: WritableComputedRef<Record<string, unknown>>;
  /** 主选中组件的顶层字段对象（供 bind:'field' 读写） */
  currentFields: WritableComputedRef<Record<string, unknown>>;
  /** 按字段声明读取值（自动区分 bind:'option' / 'field'） */
  readField: (field: PropertyField) => unknown;
  /** 按字段声明写回值（自动区分 bind:'option' / 'field'，options 缺省时惰性创建） */
  writeField: (field: PropertyField, value: unknown) => void;
  /** 主选中内容组件类型（clock 或未选中时为 null；calendar/date/lunar/weather/text 返回类型） */
  currentWidgetType: ComputedRef<string | null>;
  /** 主选中组件的样式 id（读写；clock 对应 clock.style 表盘 id，供展示或忽略） */
  currentStyle: WritableComputedRef<string>;
  updateComponentLayout: (compKey: string, layout: ComponentLayout) => void;
  /** 按 key 读取任意组件 layout（不存在返回 null） */
  layoutByKey: (key: string) => ComponentLayout | null;
  /** 按 key 写入 layout 补丁（合并到现有 layout，供对齐/图层动作使用） */
  setLayoutByKey: (key: string, patch: Partial<ComponentLayout>) => void;
}

/**
 * 创建选中态与派生数据。
 * @param draft 编辑草稿（reactive）
 */
export function useComponentSelection(draft: SnoozeConfig): ComponentSelection {
  /** 当前选中的组件 key 集合（clock / calendar / date / lunar / weather / text_N） */
  const selectedKeys = ref<string[]>(['clock']);

  /** 主选中组件（最后选中项）；设值即单选，保持旧调用点语义 */
  const selectedComponent = computed<string>({
    get: () => selectedKeys.value[selectedKeys.value.length - 1] ?? '',
    set: (v) => {
      selectedKeys.value = v ? [v] : [];
    },
  });

  /** 选中数量 */
  const selectedCount = computed(() => selectedKeys.value.length);

  /** 组件分类清单（五类固定组件 + 每条自定义文本各成一项） */
  const componentList = computed<ComponentListItem[]>(() => {
    const list: ComponentListItem[] = [
      { key: 'clock', label: '时钟', show: draft.components.clock.show, toggleable: true },
      { key: 'calendar', label: '日历', show: draft.components.calendar.show, toggleable: true },
      { key: 'date', label: '日期', show: draft.components.date.show, toggleable: true },
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

  /** 当前主选中组件的中文名（右侧属性面板标题 / 状态栏提示） */
  const selectedLabel = computed(
    () => componentList.value.find((c) => c.key === selectedComponent.value)?.label ?? '',
  );

  /** 判断某组件是否被选中 */
  function isSelected(key: string): boolean {
    return selectedKeys.value.includes(key);
  }

  /** 单选：替换整个选中集 */
  function selectOne(key: string): void {
    selectedKeys.value = [key];
  }

  /** 增量切换：已选则移除，未选则追加（Ctrl/Cmd/Shift 多选） */
  function toggleSelect(key: string): void {
    selectedKeys.value = selectedKeys.value.includes(key)
      ? selectedKeys.value.filter((k) => k !== key)
      : [...selectedKeys.value, key];
  }

  /** 批量设置选中集（去重，保持传入顺序） */
  function selectKeys(keys: string[]): void {
    selectedKeys.value = Array.from(new Set(keys));
  }

  /** 清空选中 */
  function clearSelection(): void {
    selectedKeys.value = [];
  }

  /** 组件显隐开关（clock/calendar/date/lunar/weather，以及每条自定义文本 text_N） */
  function setComponentShow(key: string, value: boolean): void {
    switch (key) {
      case 'clock': draft.components.clock.show = value; break;
      case 'calendar': draft.components.calendar.show = value; break;
      case 'date': draft.components.date.show = value; break;
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
    draft.components.texts.push({ content: '', style: 'basic', layout: { ...DEFAULT_LAYOUTS.text }, show: true });
    selectedComponent.value = `text_${draft.components.texts.length - 1}`;
  }

  /** 当前主选中的单条自定义文本下标（未选中文本时返回 -1） */
  const selectedTextIndex = computed(() => {
    if (!selectedComponent.value.startsWith('text_')) return -1;
    const idx = Number(selectedComponent.value.slice(5));
    return draft.components.texts[idx] ? idx : -1;
  });

  /** 当前主选中单条文本的内容（供属性面板直接编辑；未选中文本时返回空串） */
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

  /** 当前主选中单条文本的显隐（供属性面板开关） */
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

  /** 删除当前主选中的自定义文本（选中态回退到时钟） */
  function removeSelectedText(): void {
    const idx = selectedTextIndex.value;
    if (idx < 0) return;
    draft.components.texts.splice(idx, 1);
    selectedComponent.value = 'clock';
  }

  /** 画布点选组件 → 左侧分类与右侧属性同步切换（additive 时增量多选） */
  function onCanvasSelect(compKey: string, additive?: boolean): void {
    if (additive) toggleSelect(compKey);
    else selectOne(compKey);
  }

  /** 当前主选中组件的 layout */
  const currentLayout = computed<ComponentLayout>({
    get: () => {
      const key = selectedComponent.value;
      if (key.startsWith('text_')) {
        const text = draft.components.texts[Number(key.slice(5))];
        if (text) return text.layout;
      }
      switch (key) {
        case 'clock': return draft.components.clock.layout;
        case 'calendar': return draft.components.calendar.layout;
        case 'date': return draft.components.date.layout;
        case 'lunar': return draft.components.lunar.layout;
        case 'weather': return draft.components.weather.layout;
        default: return draft.components.clock.layout;
      }
    },
    set: (v) => {
      const key = selectedComponent.value;
      if (key.startsWith('text_')) {
        const text = draft.components.texts[Number(key.slice(5))];
        if (text) text.layout = v;
        return;
      }
      switch (key) {
        case 'clock': draft.components.clock.layout = v; break;
        case 'calendar': draft.components.calendar.layout = v; break;
        case 'date': draft.components.date.layout = v; break;
        case 'lunar': draft.components.lunar.layout = v; break;
        case 'weather': draft.components.weather.layout = v; break;
      }
    },
  });

  /** 当前主选中组件的 color */
  const currentColor = computed<string>({
    get: () => {
      const key = selectedComponent.value;
      if (key.startsWith('text_')) {
        return draft.components.texts[Number(key.slice(5))]?.color ?? '';
      }
      switch (key) {
        case 'clock': return draft.components.clock.color ?? '';
        case 'calendar': return draft.components.calendar.color ?? '';
        case 'date': return draft.components.date.color ?? '';
        case 'lunar': return draft.components.lunar.color ?? '';
        case 'weather': return draft.components.weather.color ?? '';
        default: return '';
      }
    },
    set: (v) => {
      const val = v || undefined;
      const key = selectedComponent.value;
      if (key.startsWith('text_')) {
        const text = draft.components.texts[Number(key.slice(5))];
        if (text) text.color = val;
        return;
      }
      switch (key) {
        case 'clock': draft.components.clock.color = val; break;
        case 'calendar': draft.components.calendar.color = val; break;
        case 'date': draft.components.date.color = val; break;
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

  /** 主选中内容组件类型（clock / 未知为 null；文本条目统一视为 text） */
  const currentWidgetType = computed<string | null>(() => {
    const key = selectedComponent.value;
    if (key.startsWith('text_')) return 'text';
    return key === 'calendar' || key === 'date' || key === 'lunar' || key === 'weather'
      ? key
      : null;
  });

  /** 主选中组件的样式 id（读写草稿；clock 暴露 clock.style 供展示或忽略） */
  const currentStyle = computed<string>({
    get: () => {
      const key = selectedComponent.value;
      if (key.startsWith('text_')) {
        return draft.components.texts[Number(key.slice(5))]?.style ?? '';
      }
      switch (key) {
        case 'clock': return draft.components.clock.style;
        case 'calendar': return draft.components.calendar.style;
        case 'date': return draft.components.date.style;
        case 'lunar': return draft.components.lunar.style;
        case 'weather': return draft.components.weather.style;
        default: return '';
      }
    },
    set: (v: string) => {
      const key = selectedComponent.value;
      if (key.startsWith('text_')) {
        const text = draft.components.texts[Number(key.slice(5))];
        if (text) text.style = v;
        return;
      }
      switch (key) {
        case 'clock': draft.components.clock.style = v; break;
        case 'calendar': draft.components.calendar.style = v; break;
        case 'date': draft.components.date.style = v; break;
        case 'lunar': draft.components.lunar.style = v; break;
        case 'weather': draft.components.weather.style = v; break;
      }
    },
  });

  /** 更新指定组件的 layout（数字输入直接绑定 draft，此处供预览画布拖拽回写） */
  function updateComponentLayout(compKey: string, layout: ComponentLayout): void {
    setLayoutByKey(compKey, layout);
  }

  /** 按 key 读取任意组件 layout（不存在返回 null） */
  function layoutByKey(key: string): ComponentLayout | null {
    if (key.startsWith('text_')) {
      return draft.components.texts[Number(key.slice(5))]?.layout ?? null;
    }
    switch (key) {
      case 'clock': return draft.components.clock.layout;
      case 'calendar': return draft.components.calendar.layout;
      case 'date': return draft.components.date.layout;
      case 'lunar': return draft.components.lunar.layout;
      case 'weather': return draft.components.weather.layout;
      default: return null;
    }
  }

  /** 按 key 写入 layout 补丁（合并到现有 layout） */
  function setLayoutByKey(key: string, patch: Partial<ComponentLayout>): void {
    const cur = layoutByKey(key);
    if (!cur) return;
    const next: ComponentLayout = { ...cur, ...patch };
    if (key.startsWith('text_')) {
      const t = draft.components.texts[Number(key.slice(5))];
      if (t) t.layout = next;
      return;
    }
    switch (key) {
      case 'clock': draft.components.clock.layout = next; break;
      case 'calendar': draft.components.calendar.layout = next; break;
      case 'date': draft.components.date.layout = next; break;
      case 'lunar': draft.components.lunar.layout = next; break;
      case 'weather': draft.components.weather.layout = next; break;
    }
  }

  /** 主选中组件的底层对象（clock / calendar / date / lunar / weather / text_N） */
  function currentComponentObject(): Record<string, unknown> | null {
    const key = selectedComponent.value;
    if (key.startsWith('text_')) {
      return (draft.components.texts[Number(key.slice(5))] as unknown as Record<string, unknown>) ?? null;
    }
    switch (key) {
      case 'clock': return draft.components.clock as unknown as Record<string, unknown>;
      case 'calendar': return draft.components.calendar as unknown as Record<string, unknown>;
      case 'date': return draft.components.date as unknown as Record<string, unknown>;
      case 'lunar': return draft.components.lunar as unknown as Record<string, unknown>;
      case 'weather': return draft.components.weather as unknown as Record<string, unknown>;
      default: return null;
    }
  }

  /** 主选中组件的 options 透传对象（读写 component.options；缺省返回空对象） */
  const currentOptions = computed<Record<string, unknown>>({
    get: () => {
      const opts = currentComponentObject()?.options;
      return opts && typeof opts === 'object' ? (opts as Record<string, unknown>) : {};
    },
    set: (v) => {
      const obj = currentComponentObject();
      if (obj) obj.options = { ...v };
    },
  });

  /** 主选中组件的顶层字段对象（供 bind:'field' 读写） */
  const currentFields = computed<Record<string, unknown>>({
    get: () => currentComponentObject() ?? {},
    set: (v) => {
      const obj = currentComponentObject();
      if (obj) for (const [k, val] of Object.entries(v)) obj[k] = val;
    },
  });

  /** 按字段声明读取值（自动区分 bind:'option' / 'field'） */
  function readField(field: PropertyField): unknown {
    const target = field.bind === 'field' ? currentFields.value : currentOptions.value;
    return target[field.key];
  }

  /** 按字段声明写回值；options 缺省时惰性创建，field 直接写顶层字段 */
  function writeField(field: PropertyField, value: unknown): void {
    const obj = currentComponentObject();
    if (!obj) return;
    if (field.bind === 'field') {
      obj[field.key] = value;
      return;
    }
    if (!obj.options || typeof obj.options !== 'object') obj.options = {};
    (obj.options as Record<string, unknown>)[field.key] = value;
  }

  /** 主选中组件的属性 schema：表盘取 face.schema（兜底时钟默认），widget 取样式级→类型级 */
  const currentSchema = computed<PropertyField[]>(() => {
    // 依赖注册表变更计数：运行时安装 / 卸载插件后即时刷新属性表单
    void facesVersion.value;
    void widgetsVersion.value;
    const key = selectedComponent.value;
    if (key === 'clock') {
      const face = getFace(draft.components.clock.style);
      return face.schema && face.schema.length ? face.schema : CLOCK_TYPE_SCHEMA;
    }
    if (key.startsWith('text_')) {
      const t = draft.components.texts[Number(key.slice(5))];
      return t ? getWidgetSchema('text', t.style) : [];
    }
    const wtype = currentWidgetType.value;
    return wtype ? getWidgetSchema(wtype, currentStyle.value) : [];
  });

  return {
    selectedKeys,
    selectedComponent,
    selectedCount,
    componentList,
    selectedLabel,
    isSelected,
    selectOne,
    toggleSelect,
    selectKeys,
    clearSelection,
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
    currentSchema,
    currentOptions,
    currentFields,
    readField,
    writeField,
    currentWidgetType,
    currentStyle,
    updateComponentLayout,
    layoutByKey,
    setLayoutByKey,
  };
}
