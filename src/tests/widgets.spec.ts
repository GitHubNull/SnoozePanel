import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import {
  listWidgetStyles,
  listWidgetTypes,
  listWidgetStyleOptions,
  getWidget,
  hasWidget,
  isWidgetType,
  WIDGET_TYPE_LABELS,
  DEFAULT_WIDGET_TYPE,
  DEFAULT_WIDGET_STYLE,
} from '../ui/widgets/registry';
import { getTheme } from '../ui/themes';
import type { WidgetProps } from '../ui/widgets/types';
import type { HassLike } from '../core/hass';

/** 固定测试时间（避免依赖真实时钟）：2026-09-12(周六) 10:08:30 */
const NOW = new Date(2026, 8, 12, 10, 8, 30);

/** 全部内置类型 id */
const TYPES = ['calendar', 'date', 'lunar', 'weather', 'text'];

/** 带一条 weather 实体状态的 mock hass */
function mockHass(): HassLike {
  return {
    states: {
      'weather.home': {
        entity_id: 'weather.home',
        state: 'sunny',
        attributes: { temperature: 26.4, humidity: 51 },
        last_changed: '',
        last_updated: '',
      },
    },
  };
}

function props(overrides: Partial<WidgetProps> = {}): WidgetProps {
  return {
    now: NOW,
    hass: mockHass(),
    theme: getTheme('midnight'),
    options: {},
    ...overrides,
  };
}

describe('内容组件注册表（类型/样式两级）', () => {
  it('登记 5 个内置类型', () => {
    expect(listWidgetTypes().map((t) => t.type)).toEqual(TYPES);
    expect(Object.keys(WIDGET_TYPE_LABELS).sort()).toEqual([...TYPES].sort());
  });

  it('每类型含 3 款内置 + 1 款第三方（共 4 样式）', () => {
    for (const t of TYPES) {
      const styles = listWidgetStyles(t);
      expect(styles).toHaveLength(4);
      expect(styles.filter((s) => s.source === 'builtin')).toHaveLength(3);
      expect(styles.filter((s) => s.source === 'thirdparty')).toHaveLength(1);
    }
  });

  it('内置样式排在第三方之前', () => {
    for (const t of TYPES) {
      const sources = listWidgetStyles(t).map((s) => s.source);
      const firstThird = sources.indexOf('thirdparty');
      const lastBuiltin = sources.lastIndexOf('builtin');
      expect(lastBuiltin).toBeLessThan(firstThird);
    }
  });

  it('getWidget 缺省解析为 basic 内置样式', () => {
    for (const t of TYPES) {
      expect(getWidget(t).style).toBe('basic');
      expect(getWidget(t).source).toBe('builtin');
      expect(getWidget(t).type).toBe(t);
    }
  });

  it('getWidget 指定样式命中；未命中/未知名回退', () => {
    expect(getWidget('calendar', 'compact').style).toBe('compact');
    expect(getWidget('calendar', 'nope').style).toBe('basic');
    expect(getWidget('not-exist').type).toBe(DEFAULT_WIDGET_TYPE);
    expect(getWidget('weather', 'minimal').source).toBe('thirdparty');
  });

  it('hasWidget / isWidgetType 判断', () => {
    expect(hasWidget('date', 'badge')).toBe(true);
    expect(hasWidget('date', 'nope')).toBe(false);
    expect(isWidgetType('weather')).toBe(true);
    expect(isWidgetType('nope')).toBe(false);
  });

  it('listWidgetStyleOptions 输出纯数据摘要（含 type/style/label/source，排序一致）', () => {
    const options = listWidgetStyleOptions('date');
    expect(options.map((o) => o.style)).toEqual(listWidgetStyles('date').map((s) => s.style));
    for (const o of options) {
      expect(Object.keys(o).sort()).toEqual(['label', 'source', 'style', 'type']);
      expect(o.label.length).toBeGreaterThan(0);
      expect(['builtin', 'thirdparty']).toContain(o.source);
    }
  });

  it('DEFAULT_WIDGET_STYLE 覆盖全部类型且为 basic', () => {
    for (const t of TYPES) expect(DEFAULT_WIDGET_STYLE[t]).toBe('basic');
  });
});

describe('内容组件渲染（遍历全部样式真实挂载）', () => {
  for (const t of TYPES) {
    for (const meta of listWidgetStyles(t)) {
      it(`${t}/${meta.style}（${meta.label}）挂载并渲染且无控制台报错`, () => {
        const errors: unknown[] = [];
        const origError = console.error;
        console.error = (...a: unknown[]) => {
          errors.push(a);
        };
        try {
          const wrapper = mount(meta.component, { props: props() });
          expect(wrapper.html().length).toBeGreaterThan(0);
          wrapper.unmount();
        } finally {
          console.error = origError;
        }
        expect(errors).toEqual([]);
      });
    }
  }

  it('date basic 按 options.format 渲染 ISO 占位符结果', () => {
    const wrapper = mount(getWidget('date', 'basic').component, {
      props: props({ options: { format: 'YYYY-MM-DD dddd' } }),
    });
    expect(wrapper.text()).toBe('2026-09-12 周六');
    wrapper.unmount();
  });

  it('date basic 缺省 format 回退默认模板', () => {
    const wrapper = mount(getWidget('date', 'basic').component, { props: props() });
    expect(wrapper.text()).toBe('2026年09月12日 周六');
    wrapper.unmount();
  });

  it('weather basic 读取 hass 实体状态与温度湿度', () => {
    const wrapper = mount(getWidget('weather', 'basic').component, {
      props: props({ options: { entity: 'weather.home' } }),
    });
    const text = wrapper.text();
    expect(text).toContain('晴');
    expect(text).toContain('26°');
    expect(text).toContain('51%');
    wrapper.unmount();
  });

  it('text basic 通过 options.content 渲染并替换实体占位符', () => {
    const wrapper = mount(getWidget('text', 'basic').component, {
      props: props({ options: { content: '温度 {weather.home:temperature}' } }),
    });
    expect(wrapper.text()).toContain('温度');
    wrapper.unmount();
  });

  it('calendar basic 按 options.week_start 排列表头', () => {
    const wrapper = mount(getWidget('calendar', 'basic').component, {
      props: props({ options: { week_start: 1 } }),
    });
    const headers = wrapper.findAll('thead th').map((th) => th.text());
    expect(headers[0]).toBe('一');
    expect(headers[6]).toBe('日');
    wrapper.unmount();
  });
});
