/**
 * 第三方潜水表表盘元数据。
 *
 * 约定（与 registry.ts 一致）：导出 { id, label, kind }。
 *   - id   表盘唯一标识（也用于 dirName 回退，二者保持一致）
 *   - label 编辑器 / 表盘市场显示名（中文）
 *   - kind  数字 'digital' / 模拟 'analog'
 */
export default {
  id: 'diver',
  label: '潜水表',
  kind: 'analog' as const,
};
