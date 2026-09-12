import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import { listFaces, listFaceOptions, getFace, hasFace, DEFAULT_FACE_ID } from '../ui/faces/registry';
import { getTheme } from '../ui/themes';
import type { FaceProps } from '../ui/faces/types';

/** 固定测试时间（避免依赖真实时钟） */
const NOW = new Date(2026, 8, 12, 10, 8, 30); // 2026-09-12 10:08:30

function props(): FaceProps {
  return { now: NOW, seconds: true, hour24: true, theme: getTheme('midnight') };
}

describe('表盘注册表', () => {
  it('内置 6 款表盘全部注册', () => {
    const ids = listFaces().map((f) => f.id).sort();
    expect(ids).toEqual(['analog', 'chrono', 'digital', 'minimal', 'orbit', 'ring']);
  });

  it('数字表盘排在模拟表盘之前', () => {
    const kinds = listFaces().map((f) => f.kind);
    const firstAnalog = kinds.indexOf('analog');
    const lastDigital = kinds.lastIndexOf('digital');
    expect(lastDigital).toBeLessThan(firstAnalog);
  });

  it('getFace 未知名回退默认表盘', () => {
    expect(getFace('not-exist').id).toBe(DEFAULT_FACE_ID);
  });

  it('hasFace 判断注册状态', () => {
    expect(hasFace('chrono')).toBe(true);
    expect(hasFace('nope')).toBe(false);
  });

  it('listFaceOptions 输出纯数据摘要（仅 id/label/kind，排序与 listFaces 一致）', () => {
    const options = listFaceOptions();
    expect(options.map((o) => o.id)).toEqual(listFaces().map((f) => f.id));
    for (const o of options) {
      expect(Object.keys(o).sort()).toEqual(['id', 'kind', 'label']);
      expect(o.label.length).toBeGreaterThan(0);
      expect(['digital', 'analog']).toContain(o.kind);
    }
  });
});

describe('表盘渲染（真实挂载每款表盘）', () => {
  for (const face of listFaces()) {
    it(`${face.id}（${face.label}）挂载并渲染且无控制台报错`, () => {
      const errors: unknown[] = [];
      const origError = console.error;
      console.error = (...a: unknown[]) => { errors.push(a); };
      try {
        const wrapper = mount(face.component, { props: props() });
        // 模拟表盘用 SVG 绘制；数字表盘为纯 HTML 文本，按 kind 区分校验
        if (face.kind === 'analog') {
          expect(wrapper.find('svg').exists()).toBe(true);
        }
        // 渲染结果应含实质内容（非空壳）
        expect(wrapper.html().length).toBeGreaterThan(200);
        wrapper.unmount();
      } finally {
        console.error = origError;
      }
      expect(errors).toEqual([]);
    });
  }

  it('chrono 含齿轮、子表盘与指针组结构', () => {
    const wrapper = mount(getFace('chrono').component, { props: props() });
    const html = wrapper.html();
    expect(html).toContain('<svg');
    // 两个子表盘（日期 31 天 / 星期 7 天）
    expect(html).toContain('SUN');
    // 齿轮 defs 渐变
    expect(html).toContain('url(#bezel)');
    expect(html).toContain('url(#dial)');
    wrapper.unmount();
  });

  it('ring 表盘含环形进度（stroke-dasharray）', () => {
    const wrapper = mount(getFace('ring').component, { props: props() });
    expect(wrapper.html()).toContain('stroke-dasharray');
    wrapper.unmount();
  });

  it('seconds=false 时表盘不渲染秒针/秒环', () => {
    const noSec = { ...props(), seconds: false };
    const ring = mount(getFace('ring').component, { props: noSec });
    expect(ring.html()).not.toContain('stroke-dasharray');
    ring.unmount();
  });

  it('paper 主题下 chrono 仍正常渲染', () => {
    const wrapper = mount(getFace('chrono').component, {
      props: { now: NOW, seconds: true, hour24: true, theme: getTheme('paper') },
    });
    expect(wrapper.find('svg').exists()).toBe(true);
    wrapper.unmount();
  });
});
