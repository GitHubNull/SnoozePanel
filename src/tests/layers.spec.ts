import { describe, it, expect } from 'vitest';
import { reorderLayers } from '../core/layers';

describe('reorderLayers 图层重排', () => {
  const items = [
    { key: 'a', z: 0 },
    { key: 'b', z: 1 },
    { key: 'c', z: 2 },
  ];

  it('置于顶层：目标移到最高 z', () => {
    expect(reorderLayers(items, 'a', 'front')).toEqual({ b: 0, c: 1, a: 2 });
  });

  it('置于底层：目标移到最低 z', () => {
    expect(reorderLayers(items, 'c', 'back')).toEqual({ c: 0, a: 1, b: 2 });
  });

  it('上移一层：与更高一层交换', () => {
    expect(reorderLayers(items, 'a', 'forward')).toEqual({ b: 0, a: 1, c: 2 });
  });

  it('下移一层：与更低一层交换', () => {
    expect(reorderLayers(items, 'c', 'backward')).toEqual({ a: 0, c: 1, b: 2 });
  });

  it('已在顶层时上移不变', () => {
    expect(reorderLayers(items, 'c', 'forward')).toEqual({ a: 0, b: 1, c: 2 });
  });

  it('已在底层时下移不变', () => {
    expect(reorderLayers(items, 'a', 'backward')).toEqual({ a: 0, b: 1, c: 2 });
  });

  it('输入 z 稀疏 / 重复时按升序规范化到 0..n-1（相同 z 保留输入顺序）', () => {
    const messy = [
      { key: 'a', z: 5 },
      { key: 'b', z: 5 },
      { key: 'c', z: 1 },
    ];
    // 升序后：c(1) → a(5) → b(5)，再执行 front 于 c → a、b、c
    expect(reorderLayers(messy, 'c', 'front')).toEqual({ a: 0, b: 1, c: 2 });
  });

  it('目标不存在时返回规范化后的原顺序', () => {
    expect(reorderLayers(items, 'nope', 'front')).toEqual({ a: 0, b: 1, c: 2 });
  });

  it('空列表返回空映射', () => {
    expect(reorderLayers([], 'a', 'front')).toEqual({});
  });
});
