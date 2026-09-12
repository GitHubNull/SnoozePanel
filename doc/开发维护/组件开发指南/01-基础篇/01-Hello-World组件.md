# 01-Hello-World 组件

> 目标：用 5 分钟写出你的第一个内容组件，并让它出现在编辑器里。
> 前置：已读 [AGENTS.md](../../../../AGENTS.md)，能跑通 `pnpm build`。

## 一、内容组件是什么

SnoozePanel 屏保由若干「内容组件」拼成：时钟、日历、日期、农历、天气、自定义文本。

- **时钟**是特殊的「表盘（face）」，走 `src/ui/faces/` 注册表；
- **其余全部是内容组件（widget）**，走 `src/ui/widgets/` 注册表。

本指南只讲 **widget**。widget 采用「类型 / 样式」两级目录：**在已有类型下放一个样式目录 + 一个入口组件 `index.vue`，放入即生效**。

## 二、最小组件：三行代码

在某个类型目录下新建样式目录，如 `src/ui/widgets/text/hello/`，放入 `index.vue`：

```vue
<script setup lang="ts">
import type { WidgetProps } from '../../types';
const props = defineProps<WidgetProps>();
</script>

<template>
  <div class="hello">你好，现在是 {{ props.now.getHours() }} 点</div>
</template>

<style scoped>
.hello { font-size: clamp(16px, 2.2cqw, 32px); opacity: 0.9; }
</style>
```

就这样。没有注册代码要写——注册表在构建时自动扫描到它。

> 注意：路径中 `text` 是**类型**（与已有组件并列），`hello` 是**样式 id**。目录名只用小写字母、数字，建议用 `-` 连接（如 `my-style`）。

## 三、加上元数据：中文显示名

`text/hello/widget.meta.ts`：

```ts
/** 你好组件元数据 */
export default {
  label: '你好',
};
```

- `label` 缺省时显示样式目录名（`hello`），建议补一个中文名；
- **类型与样式由目录路径决定**，无需在元数据里声明。

## 四、构建与验证

在**项目根目录**执行：

```bash
pnpm build            # 构建产物 → tmp/dist/snoozepanel.js
pnpm test             # 跑单测（widgets.spec.ts 会自动挂载每个组件）
```

真实 UI 验证（禁止脚本伪造）：

```bash
python -m http.server 8765
# 浏览器打开 http://127.0.0.1:8765/dev/
```

1. 打开编辑器 → 选中 `text` 类组件 → 打开样式弹窗，可见新增的「你好」样式；
2. 打开其显隐开关 → 画布与屏保出现「你好，现在是 X 点」；
3. 拖动组件调整位置，确认与其它组件一致可拖拽/缩放。

## 五、常见坑

| 现象 | 原因 | 解法 |
|---|---|---|
| 组件不出现 | 目录没放对 / 入口不是 `index.vue` | 确认路径是 `src/ui/widgets/<type>/<style>/index.vue` |
| 组件渲染空白 | 模板没引用 `props.xxx` | `defineProps<WidgetProps>()` 后直接用 `props.now` |
| 文字太大/太小 | 没用相对字号 | 用 `clamp(min, Xcqw, max)`，随屏幕缩放 |
| 中文乱码 | 文件非 UTF-8 | 编辑器保存为 UTF-8 |

## 下一步

- 想搞懂「放入即生效」的原理 → [02-目录契约与注册机制.md](02-目录契约与注册机制.md)
- 想按主题配色 → [03-主题与样式约定.md](03-主题与样式约定.md)
- 想写正式版组件 → [../03-组件接口规范.md](../03-组件接口规范.md)
