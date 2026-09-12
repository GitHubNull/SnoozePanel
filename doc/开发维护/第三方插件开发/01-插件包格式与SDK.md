# 01 - 插件包格式与 SDK

> 目标：说明第三方「预编译插件包（app 式）」的目录格式、宿主 SDK（`SnoozePanelPluginAPI`）接口，
> 以及从工程到可安装产物的构建约定。
>
> 阅读顺序：先读本篇建立全局认识，再按需要进入
> [02-表盘插件开发.md](02-表盘插件开发.md) /
> [03-内容组件插件开发.md](03-内容组件插件开发.md) /
> [04-安装与信任模型.md](04-安装与信任模型.md)。

## 一、两种扩展路径

SnoozePanel 支持两种第三方扩展方式，定位不同：

| 路径 | 适用 | 接入方式 | 需要重新构建宿主 |
|---|---|---|---|
| **源码目录**（构建期） | 参与本仓库共建、内置分发 | 放入 `src/ui/faces/thirdparty/<id>/` 或 `src/ui/widgets/thirdparty/<type>/<style>/` | 是（`pnpm build`） |
| **预编译插件包**（运行时） | 独立分发、用户自行安装 | 编译为 `<id>/index.js` + `plugin.json`，用户经市场「安装插件」导入 | 否 |

本篇及后续三篇聚焦**预编译插件包**。源码目录方式见
[第三方表盘开发指南.md](../第三方表盘开发指南.md) /
[第三方组件开发指南.md](../第三方组件开发指南.md)。

## 二、插件包格式

一个插件包就是一个目录（目录名即插件 id）：

```
<id>/
├── plugin.json   # 必需：清单（元数据 + 入口声明）
└── index.js      # 必需：自包含 IIFE 产物（构建生成，不打包 Vue）
```

- 目录名必须满足插件 id 规则：`^[a-z0-9][a-z0-9-]{0,63}$`（小写字母 / 数字 / 连字符，字母或数字开头）。
- `index.js` 由仓库提供的构建工具生成（见第六节），是**自包含**的，仅依赖宿主注入的全局 SDK。
- `plugin.json` 供构建工具、安装弹窗与市场读取。

### plugin.json 字段

```json
{
  "id": "pixel",
  "kind": "face",
  "label": "像素时钟",
  "entry": "index.js",
  "apiVersion": 1,
  "author": "SnoozePanel 社区",
  "version": "1.0.0",
  "summary": "复古霓虹风格的数字时钟，支持自定义强调色与发光。",
  "description": "演示第三方表盘插件的最小实现……",
  "usage": "安装后于「表盘市场」中选择「像素时钟」……",
  "homepage": "https://github.com/snoozepanel/snoozepanel",
  "license": "MIT"
}
```

| 字段 | 必需 | 说明 |
|---|---|---|
| `id` | ✅ | 插件唯一标识，**必须与目录名一致**；满足 id 规则 |
| `kind` | ✅ | `'face'`（表盘）或 `'widget'`（内容组件） |
| `label` | 建议 | 中文显示名（市场卡片 / 下拉） |
| `type` | widget 必填 | 内容组件类型 id（`calendar`/`date`/`lunar`/`weather`/`text`） |
| `style` | widget 必填 | 内容组件样式 id（类型内唯一） |
| `entry` | 可选 | 入口文件名，缺省 `index.js`；**仅纯文件名，禁止路径穿越** |
| `apiVersion` | 建议 | 目标 SDK 版本，当前为 `1`（对应 `SnoozePanelPluginAPI.apiVersion`） |
| `author` / `version` / `summary` / `description` / `usage` / `homepage` / `license` | 可选 | 元数据，市场卡片与详情页展示 |

> 元数据也可在 `index.js` 的 `registerFace/registerWidget` 调用里重复声明（市场优先取注册值）。
> 推荐两者保持一致，便于「未安装时也能看到清单信息」。

## 三、宿主 SDK：`SnoozePanelPluginAPI`

宿主在页面加载时安装全局 SDK（`src/ui/plugins/sdk.ts` 的 `installPluginSDK()`），
插件脚本注入后即可读取 `window.SnoozePanelPluginAPI`：

```ts
interface SnoozePanelPluginApi {
  apiVersion: number;                             // 当前为 1
  vue: {                                          // 宿主 Vue 运行时子集
    defineComponent; h; ref; computed; reactive; watch;
    onMounted; onBeforeUnmount; nextTick; useId;
  };
  core: {                                         // 宿主纯函数核心（只读）
    clock;    // core/clock：日历/周数/日期格式化
    lunar;    // core/lunar：农历换算与格式化
    text;     // core/text：实体占位符替换
    template; // core/template：display_template 安全求值
  };
  registerFace(meta: FacePluginMeta): void;       // 注册表盘
  registerWidget(meta: WidgetPluginMeta): void;   // 注册内容组件
}
```

- **`vue`**：插件**不打包 Vue**，改用宿主注入的同一份运行时（避免多实例问题）。
  构建配置通过 `external: ['vue']` + `globals: { vue: 'SnoozePanelPluginAPI.vue' }` 实现映射。
- **`core`**：宿主核心纯函数命名空间，可直接复用（如 `core.clock.formatDate`），无需自带。
- **`registerFace` / `registerWidget`**：把组件写入宿主**运行时注册表**，成功后市场与下拉即时刷新。
  注册参数非法时会抛错（`registerFace` 需 `{ id, label, kind, component }`；
  `registerWidget` 需 `{ type, style, label, component }`）。

### 注册元数据（`FacePluginMeta` / `WidgetPluginMeta`）

```ts
interface FacePluginMeta {
  id: string; label: string; kind: 'digital' | 'analog';
  component: Component;
  // 以下均来自 PluginMeta，可选
  author?: string; version?: string; summary?: string; description?: string;
  usage?: string; homepage?: string; license?: string;
  schema?: PropertyField[];   // 属性面板 schema（见第五节）
}

interface WidgetPluginMeta {
  type: string; style: string; label: string;
  component: Component;
  // ……同上 PluginMeta 可选字段
}
```

## 四、插件组件接口

插件组件接收与宿主内置组件**完全一致**的 props，保证行为一致：

| 种类 | Props |
|---|---|
| 表盘（face） | `now: Date`、`seconds: boolean`、`hour24: boolean`、`theme: Theme`、`options: Record<string, unknown>` |
| 内容组件（widget） | `now: Date`、`hass: HassLike`、`theme: Theme`、`options: Record<string, unknown>`、`color?: string` |

- `now` 由外层 1s tick 驱动；`theme` 见宿主 `Theme`（按 `theme.key` 取色）。
- `options` 是插件的**自定义配置入口**：属性面板按 `schema` 写入 `options[key]`。

## 五、属性 schema（`PropertyField`）

插件可在注册元数据中声明 `schema`，宿主属性面板据此**动态渲染控件**并写回配置：

```ts
interface PropertyField {
  key: string;                                   // options[key] 或顶层字段名
  label: string;                                 // 中文标签
  type: 'color' | 'number' | 'boolean' | 'select' | 'text' | 'textarea';
  bind?: 'option' | 'field';                      // 缺省 'option' → options[key]
  default?: unknown;                             // 仅占位展示，不写入草稿
  min?: number; max?: number; step?: number; suffix?: string;  // number 约束
  options?: { label: string; value: string | number }[];      // select 候选项
  group?: string;                                // 分组标题
  hint?: string;                                 // 字段提示
}
```

表盘插件示例：

```ts
schema: [
  { key: 'accent', label: '强调色', type: 'color', default: '#7fd3ff' },
  { key: 'glow', label: '霓虹发光', type: 'boolean', default: true },
]
```

> 插件（运行时注册）一律用默认的 `bind: 'option'`，即写入 `component.options[key]`。
> `bind: 'field'` 仅用于宿主内置组件的顶层字段复用，第三方插件无需使用。

## 六、构建插件包

仓库根提供插件构建工具，复用仓库的 Vite / Vue 依赖，无需插件自建工具链：

```bash
# 编译指定插件工程到 <outBase>/<id>/（缺省 outBase = 当前目录）
pnpm build:plugin plugin-template dist

# 编译仓内示例到 tmp/plugins/（端到端验证用）
pnpm build:plugin:examples
```

产物目录含 `index.js`（自包含 IIFE）与 `plugin.json`，可直接拷进 HA `/local` 目录或被上传安装。

构建关键约定（见 `vite.plugin.config.ts`）：

- `external: ['vue']` + `globals: { vue: 'SnoozePanelPluginAPI.vue' }`：**不打包 Vue**，复用宿主运行时；
- `format: 'iife'` + `cssCodeSplit: false` + CSS 注入 JS：单文件自包含；
- `entry` 固定为插件工程的 `src/index.ts`；产物文件名固定 `index.js`。

> 插件工程约定：根目录放 `plugin.json`，源码入口为 `src/index.ts`（或 `.vue`，构建已启用 Vue 插件）。

## 七、红线与限制

- **不外发请求**：插件代码禁止出现 `fetch` / `XMLHttpRequest` / `sendBeacon` 等外发行为（违者返工）。
- **无法真正卸载**：同源脚本一旦执行，浏览器不允许移除；「卸载」仅从运行时注册表移除，彻底清理需刷新页面。
- **完整权限执行**：插件代码在 HA 页面以与宿主同等权限运行，安装前务必确认来源可信（见 [04-安装与信任模型.md](04-安装与信任模型.md)）。
