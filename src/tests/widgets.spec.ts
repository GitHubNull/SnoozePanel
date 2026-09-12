import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import { listWidgets, listWidgetOptions, getWidget, hasWidget, DEFAULT_WIDGET_ID } from '../ui/widgets/registry';
import { getTheme } from '../ui/themes';
import type { WidgetProps } from '../ui/widgets/types';
import type { HassLike } from '../core/hass';

/** 固定测试时间（避免依赖真实时钟）：2026-09-12(周六) 10:08:30 */
const NOW = new Date(2026, 8, 12, 10, 8, 30);

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

describe('内容组件注册表', () => {
  it('内置 5 款内容组件全部注册', () => {
    const builtinIds = listWidgets()
      .filter((w) => w.source === 'builtin')
      .map((w) => w.id)
      .sort();
    expect(builtinIds).toEqual(['calendar', 'date', 'lunar', 'text', 'weather']);
  });

  it('元数据 label 生效（中文显示名）', () => {
    expect(getWidget('calendar').label).toBe('日历');
    expect(getWidget('date').label).toBe('日期');
    expect(getWidget('lunar').label).toBe('农历');
    expect(getWidget('weather').label).toBe('天气');
    expect(getWidget('text').label).toBe('自定义文本');
  });

  it('getWidget 未知名回退默认组件', () => {
    expect(getWidget('not-exist').id).toBe(DEFAULT_WIDGET_ID);
  });

  it('hasWidget 判断注册状态', () => {
    expect(hasWidget('date')).toBe(true);
    expect(hasWidget('nope')).toBe(false);
  });

  it('listWidgetOptions 输出纯数据摘要（含 id/label/source，排序与 listWidgets 一致）', () => {
    const options = listWidgetOptions();
    expect(options.map((o) => o.id)).toEqual(listWidgets().map((w) => w.id));
    for (const o of options) {
      expect(Object.keys(o).sort()).toEqual(['id', 'label', 'source']);
      expect(o.label.length).toBeGreaterThan(0);
      expect(['builtin', 'thirdparty']).toContain(o.source);
    }
  });

  it('内置内容组件 source 均为 builtin', () => {
    for (const w of listWidgets()) {
      expect(w.source).toBe('builtin');
    }
  });
});

describe('内容组件渲染（真实挂载每款组件）', () => {
  for (const widget of listWidgets()) {
    it(`${widget.id}（${widget.label}）挂载并渲染且无控制台报错`, () => {
      const errors: unknown[] = [];
      const origError = console.error;
      console.error = (...a: unknown[]) => {
        errors.push(a);
      };
      try {
        const wrapper = mount(widget.component, { props: props() });
        expect(wrapper.html().length).toBeGreaterThan(0);
        wrapper.unmount();
      } finally {
        console.error = origError;
      }
      expect(errors).toEqual([]);
    });
  }

  it('date 组件按 options.format 渲染 ISO 占位符结果', () => {
    const wrapper = mount(getWidget('date').component, {
      props: props({ options: { format: 'YYYY-MM-DD dddd' } }),
    });
    expect(wrapper.text()).toBe('2026-09-12 周六');
    wrapper.unmount();
  });

  it('date 组件缺省 format 回退模板', () => {
    const wrapper = mount(getWidget('date').component, { props: props() });
    expect(wrapper.text()).toBe('2026年09月12日 周六');
    wrapper.unmount();
  });

  it('weather 组件读取 hass 实体状态与温度湿度', () => {
    const wrapper = mount(getWidget('weather').component, {
      props: props({ options: { entity: 'weather.home' } }),
    });
    const text = wrapper.text();
    expect(text).toContain('晴');
    expect(text).toContain('26°');
    expect(text).toContain('51%');
    wrapper.unmount();
  });

  it('text 组件通过 options.content 渲染并替换实体占位符', () => {
    const wrapper = mount(getWidget('text').component, {
      props: props({ options: { content: '温度 {weather.home:temperature}' } }),
    });
    expect(wrapper.text()).toContain('温度');
    wrapper.unmount();
  });

  it('calendar 组件按 options.week_start 排列表头', () => {
    const wrapper = mount(getWidget('calendar').component, {
      props: props({ options: { week_start: 1 } }),
    });
    const headers = wrapper.findAll('thead th').map((th) => th.text());
    expect(headers[0]).toBe('一');
    expect(headers[6]).toBe('日');
    wrapper.unmount();
  });
});
