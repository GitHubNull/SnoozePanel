/**
 * 图层排序纯函数（无 DOM、无副作用，可单测）。
 *
 * z 采用「密集序」：把输入按 z 升序规范化到 0..n-1（z 越大越靠前），
 * 再在序列上执行置顶 / 置底 / 上移 / 下移，最后返回 key→z 的完整映射。
 * z 相同则按输入顺序稳定排序，保证结果可复现。
 */

/** 图层操作：置顶 / 置底 / 上移一层 / 下移一层 */
export type LayerOp = 'front' | 'back' | 'forward' | 'backward';

/**
 * 在 z 序列上执行图层重排。
 * @param items  组件 key 与当前 z（缺省值由调用方按清单索引预填）
 * @param target 目标组件 key
 * @param op     操作类型
 * @returns      key → z（0..n-1）的完整映射；target 不存在时返回规范化后的原顺序
 */
export function reorderLayers(
  items: { key: string; z: number }[],
  target: string,
  op: LayerOp,
): Record<string, number> {
  const n = items.length;
  if (n === 0) return {};

  // 按 z 升序稳定排序（相同 z 保留输入顺序）→ 得到规范化顺序
  const order = items
    .map((it, i) => ({ key: it.key, z: it.z, i }))
    .sort((a, b) => a.z - b.z || a.i - b.i)
    .map((it) => it.key);

  const pos = order.indexOf(target);
  if (pos >= 0) {
    switch (op) {
      case 'front':
        order.splice(pos, 1);
        order.push(target);
        break;
      case 'back':
        order.splice(pos, 1);
        order.unshift(target);
        break;
      case 'forward':
        if (pos < n - 1) [order[pos], order[pos + 1]] = [order[pos + 1], order[pos]];
        break;
      case 'backward':
        if (pos > 0) [order[pos], order[pos - 1]] = [order[pos - 1], order[pos]];
        break;
    }
  }

  const out: Record<string, number> = {};
  order.forEach((key, idx) => {
    out[key] = idx;
  });
  return out;
}
