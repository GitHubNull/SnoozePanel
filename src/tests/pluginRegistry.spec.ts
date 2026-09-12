import { describe, it, expect } from 'vitest';
import { defineComponent, reactive } from 'vue';
import { normalizeConfig } from '../core/config';
import { useComponentSelection } from '../editor/composables/useComponentSelection';
import {
  registerRuntimeFace,
  unregisterRuntimeFace,
  hasFace,
  getFace,
  listFaces,
  listFaceOptions,
  facesVersion,
  CLOCK_TYPE_SCHEMA,
} from '../ui/faces/registry';
import {
  registerRuntimeWidget,
  unregisterRuntimeWidget,
  hasWidget,
  getWidget,
  listWidgetStyles,
  widgetsVersion,
} from '../ui/widgets/registry';
import type { FacePluginMeta, PropertyField, WidgetPluginMeta } from '../ui/plugins/types';

/** 最小占位组件（运行时注册只要求存在 component 引用） */
const Dummy = defineComponent({ render: () => null });

/** 构造运行时表盘注册元数据 */
function faceMeta(id: string): FacePluginMeta {
  return {
    id,
    label: `运行时表盘 ${id}`,
    kind: 'digital',
    component: Dummy,
    author: '第三方作者',
    version: '2.0.0',
    summary: '运行时安装表盘',
    schema: [{ key: 'accent', label: '强调色', type: 'color' }],
  };
}

/** 构造运行时内容组件注册元数据 */
function widgetMeta(type: string, style: string): WidgetPluginMeta {
  return {
    type,
    style,
    label: `运行时 ${type}/${style}`,
    component: Dummy,
    schema: [{ key: 'foo', label: 'Foo', type: 'text' }],
  };
}

describe('运行时注册表（第三方插件包）', () => {
  it('registerRuntimeFace 注册新表盘并递增 facesVersion', () => {
    const before = facesVersion.value;
    const isNew = registerRuntimeFace(faceMeta('rt-face'));
    expect(isNew).toBe(true);
    expect(facesVersion.value).toBe(before + 1);
    expect(hasFace('rt-face')).toBe(true);

    const f = getFace('rt-face');
    expect(f.source).toBe('thirdparty');
    expect(f.installed).toBe(true);
    expect(f.author).toBe('第三方作者');
    expect(f.schema?.[0].key).toBe('accent');

    const opt = listFaceOptions().find((o) => o.id === 'rt-face');
    expect(opt?.source).toBe('thirdparty');
    expect(opt?.summary).toBe('运行时安装表盘');

    unregisterRuntimeFace('rt-face');
  });

  it('registerRuntimeFace 同 id 覆盖（isNew=false，不新增条目）', () => {
    registerRuntimeFace(faceMeta('rt-face2'));
    const count = listFaces().length;
    const isNew = registerRuntimeFace(faceMeta('rt-face2'));
    expect(isNew).toBe(false);
    expect(listFaces().length).toBe(count);
    unregisterRuntimeFace('rt-face2');
  });

  it('unregisterRuntimeFace 移除并递增 facesVersion（重复卸载返回 false）', () => {
    registerRuntimeFace(faceMeta('rt-face3'));
    const before = facesVersion.value;
    expect(unregisterRuntimeFace('rt-face3')).toBe(true);
    expect(facesVersion.value).toBe(before + 1);
    expect(hasFace('rt-face3')).toBe(false);
    expect(unregisterRuntimeFace('rt-face3')).toBe(false);
  });

  it('registerRuntimeWidget 注册新样式并递增 widgetsVersion', () => {
    const before = widgetsVersion.value;
    const isNew = registerRuntimeWidget(widgetMeta('text', 'rt-style'));
    expect(isNew).toBe(true);
    expect(widgetsVersion.value).toBe(before + 1);
    expect(hasWidget('text', 'rt-style')).toBe(true);

    const w = getWidget('text', 'rt-style');
    expect(w.source).toBe('thirdparty');
    expect(w.installed).toBe(true);

    // 第三方样式排在内置之后
    const styles = listWidgetStyles('text').map((s) => s.style);
    expect(styles[styles.length - 1]).toBe('rt-style');

    unregisterRuntimeWidget('text', 'rt-style');
  });

  it('registerRuntimeWidget 同 type+style 覆盖内置', () => {
    const original = getWidget('date', 'basic').label;
    registerRuntimeWidget({ type: 'date', style: 'basic', label: '覆盖日期', component: Dummy });
    const w = getWidget('date', 'basic');
    expect(w.label).toBe('覆盖日期');
    expect(w.source).toBe('thirdparty');
    unregisterRuntimeWidget('date', 'basic');
    // 反注册后还原内置
    expect(getWidget('date', 'basic').label).toBe(original);
    expect(getWidget('date', 'basic').source).toBe('builtin');
  });

  it('unregisterRuntimeWidget 移除并递增 widgetsVersion', () => {
    registerRuntimeWidget(widgetMeta('text', 'rt-style2'));
    const before = widgetsVersion.value;
    expect(unregisterRuntimeWidget('text', 'rt-style2')).toBe(true);
    expect(widgetsVersion.value).toBe(before + 1);
    expect(hasWidget('text', 'rt-style2')).toBe(false);
  });
});

describe('属性字段 bind 解析（readField / writeField）', () => {
  it('bind:field 读写组件顶层字段（时钟秒显示）', () => {
    const draft = reactive(normalizeConfig({}));
    const sel = useComponentSelection(draft);
    sel.selectOne('clock');

    const field = CLOCK_TYPE_SCHEMA.find((f) => f.key === 'seconds') as PropertyField;
    expect(field.bind).toBe('field');
    expect(sel.readField(field)).toBe(draft.components.clock.seconds);

    sel.writeField(field, true);
    expect(draft.components.clock.seconds).toBe(true);
  });

  it('bind:option（默认）读写 options，缺省时惰性创建', () => {
    const draft = reactive(
      normalizeConfig({ components: { clock: { options: { accent: '#abc' } } } }),
    );
    const sel = useComponentSelection(draft);
    sel.selectOne('clock');

    const field: PropertyField = { key: 'accent', label: '强调色', type: 'color' };
    expect(sel.readField(field)).toBe('#abc');
    sel.writeField(field, '#ff0000');
    expect(draft.components.clock.options).toEqual({ accent: '#ff0000' });

    // options 缺省时写入需惰性创建对象
    const draft2 = reactive(normalizeConfig({}));
    const sel2 = useComponentSelection(draft2);
    sel2.selectOne('clock');
    expect(draft2.components.clock.options).toBeUndefined();
    sel2.writeField({ key: 'foo', label: 'Foo', type: 'text' }, 'bar');
    expect(draft2.components.clock.options).toEqual({ foo: 'bar' });
  });

  it('内建内容组件 schema 以 bind:field 写回顶层字段', () => {
    const draft = reactive(normalizeConfig({}));
    const sel = useComponentSelection(draft);
    sel.selectOne('calendar');

    const field = sel.currentSchema.value.find((f) => f.key === 'week_start') as PropertyField;
    expect(field.bind).toBe('field');
    sel.writeField(field, 0);
    expect(draft.components.calendar.week_start).toBe(0);
  });

  it('clock 缺省 schema 回退时钟类型默认 schema', () => {
    const draft = reactive(normalizeConfig({}));
    const sel = useComponentSelection(draft);
    sel.selectOne('clock');
    expect(sel.currentSchema.value.map((f) => f.key)).toEqual(['hour24', 'seconds']);
  });
});
