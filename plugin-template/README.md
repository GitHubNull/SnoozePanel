# SnoozePanel 插件模板（像素时钟）

一个可整目录拷贝的最小「预编译插件包」示例。插件仅依赖宿主 SDK 暴露的全局接口，
构建产物为自包含 IIFE（`index.js`）+ 清单（`plugin.json`），可通过 HA 本地目录或
文件上传装入 SnoozePanel 运行时注册表。

## 目录结构

```
plugin-template/
├── plugin.json      # 插件清单：id / kind / entry / 元数据（作者、版本、简介…）
├── src/index.ts     # 插件入口：注册表盘/组件，调用 SnoozePanelPluginAPI.registerFace
└── README.md
```

## 开发与构建

1. 拷贝本目录为新插件工程，修改 `plugin.json` 的 `id`（须匹配 `^[a-z0-9][a-z0-9-]{0,63}$`）
   与 `src/index.ts` 中的注册信息。

2. 在仓库根构建：

   ```bash
   # 编译指定插件目录，产物输出到 <outBase>/<id>/
   pnpm build:plugin plugin-template dist

   # 编译仓内示例到 tmp/plugins/（端到端验证用）
   pnpm build:plugin:examples
   ```

3. 产物目录结构：

   ```
   <outBase>/<id>/
   ├── index.js       # 自包含 IIFE（不打包 Vue，改用宿主运行时）
   └── plugin.json
   ```

## 安装

- **HA 本地目录**：把产物目录整体拷贝到 HA 的 `config/www/snoozepanel/plugins/<id>/`，
  在「市场 → 安装插件 → HA 本地目录」中填入 `<id>` 导入。
- **文件上传**：在「市场 → 安装插件 → 文件上传」中选择产物的 `index.js`
  （可选附带 `plugin.json`）。

> 安全提示：插件代码将在 HA 页面以完全权限执行（等同页面权限），安装前请确认来源可信。

## 关键约定

- **不打包 Vue**：`vue` 由宿主通过 `SnoozePanelPluginAPI.vue` 提供，避免多实例问题。
- **统一 props**：表盘接收 `FaceProps`（`now` / `seconds` / `hour24` / `theme` / `options`）；
  组件样式接收 `WidgetProps`（`now` / `hass` / `theme` / `options` / `color`）。
- **元数据 schema**：在注册对象上声明 `schema`（`PropertyField[]`），宿主属性面板据此渲染控件
  并写入 `options`。
- **禁止外发请求**：插件不得发起任何网络请求或遥测。

更详细的规范见 `doc/开发维护/第三方插件开发/`。
