# AGENTS.md — AI 编程代理入口规范

> 本文件是 AI 编程代理（Qoder / Cursor / Copilot 等）进入本仓库的**第一份必读文档**。
> 读完本文件再动手，能避免 90% 的方向性错误。

## 项目一句话

Home Assistant 仪表板屏保插件：视图 YAML 写 `snoozepanel:` 段即启用，闲置后全屏屏保（时钟/日历/农历/天气/自定义文本），触摸退出不刷新页面。

## 目录结构（严格遵守）

```
项目根/
├── src/                    # 唯一入库源码目录（.ts / .vue）
│   ├── main.ts             # 入口：注册 <snooze-panel> 与 <snooze-panel-editor>；暴露 SnoozePanelTestApi（实测支撑）
│   ├── panel.ts            # SnoozePanelElement：hass setter / 视图配置读取 / 生命周期
│   ├── core/               # 纯函数核心层（无 DOM 依赖，全部可单测）
│   │   ├── types.ts        # SnoozeConfig 全量类型 + DEFAULT_CONFIG
│   │   ├── config.ts       # normalizeConfig：配置规范化/校验/默认值填充
│   │   ├── device.ts       # resolveDeviceId / isDeviceAllowed
│   │   ├── conditions.ts   # evalConditions：idle/entity/time/sun AND 求值
│   │   ├── lunar.ts        # solarToLunar / formatLunar（1900–2100 自包含位表）
│   │   ├── clock.ts        # 日历/周数/日期格式化（formatDate 支持 ISO 占位符 YYYY/YY/MM/M/DD/D/dddd/ddd）
│   │   ├── template.ts     # evalTemplate：display_template 安全求值
│   │   ├── align.ts        # alignDeltas / distributeDeltas：对齐/分布位移纯函数
│   │   ├── layers.ts       # reorderLayers：图层置顶/置底/上移/下移 + z 规范化
│   │   ├── text.ts         # 实体占位符替换
│   │   ├── pluginTypes.ts  # 插件安装纯数据契约（Manifest / Record，无 vue/DOM 依赖）
│   │   ├── pluginLimits.ts # 插件上传限额与校验纯函数（前后端同口径）
│   │   ├── pluginStore.ts  # 插件安装记录读写封装（hass.callWS 走后端 .storage）
│   │   ├── styleMirror.ts  # 样式镜像：head 样式镜像进元素自有 shadow root（修 HA shadow 托管样式丢失）
│   │   └── hass.ts         # HassEntity 等 HA 类型
│   ├── runtime/            # 运行时层（DOM/定时器/事件）
│   │   ├── controller.ts   # SnoozeController：激活/退出状态机、闲置计时、冷却
│   │   ├── mount.ts        # mountScreensaver：Vue 子应用挂载/卸载
│   │   ├── preview.ts      # mountFacePreview：表盘缩略预览挂载封装（供 dev 页跨 IIFE 调用）
│   │   ├── pluginLoader.ts # 运行时插件加载器（注入 <script> / blob: + 校验注册结果）
│   │   └── ticker.ts       # Ticker：1s tick，后台标签页暂停
│   ├── ui/                 # 屏保 UI
│   │   ├── ScreensaverApp.vue
│   │   ├── components/     # ComponentWrapper / FacePreview（缩略预览摄像机）/ DevicePreview / ScreenRulers
│   │   ├── widgets/        # 内容组件框架：registry.ts（import.meta.glob 构建时收集）+ types.ts + 类型/样式两级目录（<type>/<style>/…）+ thirdparty/
│   │   ├── faces/          # 表盘框架：registry.ts（构建期 import.meta.glob 收集 + 运行时注册表合并视图 + facesVersion）+ types.ts + 各表盘目录（digital/ring/analog/chrono/minimal/orbit）
│   │   ├── plugins/        # 插件体系：sdk.ts（window.SnoozePanelPluginAPI 全局宿主 SDK）+ types.ts（PropertyField / PluginMeta / *PluginMeta）
│   │   └── themes.ts       # midnight / paper 两套主题
│   ├── editor/             # GUI 编辑器
│   │   ├── editor.ts       # SnoozePanelEditorElement（HA card editor 协议）
│   │   ├── EditorApp.vue   # 编辑器根：瘦编排层（组织五区子组件 + TopToolbar + Toast + 表盘市场，provide 四份共享上下文）
│   │   ├── editorContext.ts # 编辑器共享上下文注入键与 helper（草稿 / UI 偏好 / 选中态 / 工具条动作）
│   │   ├── editor.css      # 编辑器五区共享样式（各子组件以 <style scoped src> 复用）
│   │   ├── PluginInstallDialog.vue # 插件安装弹窗（HA 本地目录 / 文件上传双通道 + 限额校验 + 信任提示）
│   │   ├── market/         # 市场共享组件（MarketCard / MarketDetail，表盘与组件市场复用）
│   │   ├── components/     # 五区子组件（EditorMenuBar / TopToolbar / CategoryPanel / EditorCanvas / PropertyPanel / StatusBar）
│   │   ├── composables/    # 组合式函数（useEditorDraft / useComponentSelection / useAlignmentActions / useLayerActions / useEditorShortcuts / useDeviceSave）
│   │   ├── useEditorLayout.ts # 编辑器 UI 偏好：面板宽度/收起 + 画布网格/磁吸（localStorage，仅 UI）
│   │   ├── panels/         # 菜单栏全局配置浮层（Basic / Appearance / Conditions / Device / Advanced）
│   │   └── forms/          # 复用分区表单（EntityConditionsForm / PropertySchemaForm 元数据驱动属性表单）
│   ├── sidebar/            # 侧边栏入口元素（panel_custom 协议）：sidebar.ts + SidebarApp.vue（自有 shadow root + 样式镜像）
│   ├── styles/             # 打包 CSS 标记文件 bundle.css（loud 注释标记，供 styleMirror 识别）
│   └── tests/              # Vitest 单测（*.spec.ts）
├── dev/                    # ★ 本地 mock 实测页（必须入库，供他人测试/核对/验证）
│   ├── index.html          # 页面结构 + 内联样式（顶栏可收起 / 背板舞台内嵌插件 / 底栏可拖高可收起；内置 mock hass，动态加载 tmp/dist 产物）
│   ├── dev.js              # 入口：仅事件绑定 bindEvents 与启动 bootstrap（// @ts-check + JSDoc）
│   ├── types.js            # 共享 JSDoc 类型定义（由 tsconfig.dev.json 统一校验）
│   ├── constants.js        # 常量（实体名 / 冷却 / 产物路径 / 日志上限 / 布局 key / 底栏高度）
│   ├── state.js            # 页面元素引用 + 可变运行时状态（单一对象承载，避免 ESM 重赋值失效）
│   ├── log.js              # 分级日志 / Toast / 按钮 busy 态
│   ├── mock.js             # mock hass + mock 后端（WS 读写）+ 设备列表渲染
│   ├── bundle.js           # 构建产物加载与状态徽标
│   ├── config.js           # 运行时配置构建与读取
│   ├── editor.js           # 内嵌编辑器创建与 config-changed 桥接
│   ├── runtime.js          # 运行时挂载/触发/退出/卸载 + 状态徽标
│   └── layout.js           # 实测台 UI 布局偏好（顶栏收起 / 底栏高度·收起，localStorage）
├── plugin-template/        # ★ 第三方插件工程模板（示例「像素时钟」，可整目录拷贝起步）
│   ├── src/index.ts        # 示例插件（仅依赖宿主 SDK，不打包 Vue）
│   ├── plugin.json         # 插件清单
│   └── README.md           # 使用说明
├── scripts/                # 构建辅助脚本（Node ESM）
│   └── build-plugin.mjs    # 插件包构建脚本（build:plugin / build:plugin:examples）
├── doc/                    # 文档（见下方文档体系）
├── img/                    # 截图（README 引用）
├── tmp/                    # 唯一临时目录：构建产物/验证截图/一次性脚本/垃圾数据/敏感文件（整体 .gitignore）
│   ├── dist/snoozepanel.js # 构建产物（单文件 IIFE）
│   ├── plugins/            # 示例插件编译产物（不入库）
│   ├── tools/              # 一次性只读探测脚本（不入库）
│   ├── ha_inventory/       # 设备清单导出（不入库）
│   └── HA_info.txt         # 生产令牌等敏感信息（不入库）
├── package.json            # 工程清单
├── pnpm-lock.yaml          # 依赖锁文件
├── vite.config.ts          # Vite lib 构建配置（主产物）
├── vite.plugin.config.ts   # Vite 插件包构建配置（IIFE + external vue）
├── vitest.config.ts        # 测试配置
├── tsconfig.json           # TypeScript 配置
├── node_modules/           # pnpm 依赖（实体安装）
├── .gitignore
├── README.md
└── AGENTS.md               # 本文件
```

## 构建与测试命令

所有命令在**项目根目录**下执行：

```bash
pnpm install          # 安装依赖（首次）
pnpm build            # 构建 → tmp/dist/snoozepanel.js
pnpm build:plugin <dir> [out]  # 编译单个插件工程 → <out>/<id>/（index.js + plugin.json）
pnpm build:plugin:examples     # 编译仓内示例 → tmp/plugins/
pnpm test             # 跑全部单测（Vitest）
pnpm test:watch       # watch 模式
pnpm typecheck        # vue-tsc 全量类型检查（src）
pnpm typecheck:dev    # tsc 检查 dev/**/*.js（allowJs + checkJs）
pnpm lint             # ESLint（src + dev + 工程配置）
```

本地 mock 实测：

```bash
python -m http.server 8765   # 或任意静态服务器
# 浏览器打开 http://127.0.0.1:8765/dev/
```

## 目录纪律（红线）

1. **工程文件在项目根**：`package.json` / `pnpm-lock.yaml` / `vite.config.ts` / `vitest.config.ts` / `tsconfig.json` / `node_modules/` 均位于项目根，符合常规 Node 项目结构，**严禁移入 `tmp/`**。
2. **`dev/` 是入库测试基建**：mock 实测页（`dev/index.html`）供他人测试/核对/验证，**必须入库**，严禁放入 `tmp/` 或被 `.gitignore` 忽略。
3. **`tmp/` 是唯一临时目录**：构建产物（`tmp/dist/`）、验证截图、一次性辅助脚本、垃圾/测试数据、敏感文件放 `tmp/`，整体已被 `.gitignore` 排除。
4. **`src/` 只放入库源码**：`.ts` / `.vue`，禁止放测试快照、临时脚本、构建产物。
5. **`plugin-template/` 与 `scripts/` 也是入库内容**：插件模板工程与构建脚本随仓库分发，**必须入库**；插件编译产物放 `tmp/plugins/`（不入库）。

## 安全红线（违反即返工）

- **令牌/密钥绝不入库**：`tmp/HA_info.txt`（生产令牌）、`tmp/HA_PROJECT_NOTES.md`（SSH 密钥路径+内网拓扑）、`tmp/tools/`、`tmp/ha_inventory/` 已在 `.gitignore`，严禁 `git add -f` 强制添加。
- **生产 HA 只读探测**：对生产环境（http://192.168.31.205:8123）只允许只读 API 调用；如需写入实测，必须在专用 `snoozepanel-test` 视图，完毕立即删除恢复原状。
- **不收集数据**：插件代码中严禁出现任何遥测、上报、外发请求；运行时插件仅允许从同源 `/local` 目录或本地 `blob:` 加载，**严禁加载任意外网 URL**。

## 架构要点（改动前必读）

- **配置持久化必须依赖 HA 后端**：视图级配置随 lovelace 存储持久化；**设备级配置记录（每台平板的独立设置）必须落盘到 HA 后端**（custom component + `.storage/`），严禁仅用浏览器 `localStorage` 承载配置——HA 重启、清缓存、换 App 都会丢。当前 device id 用 localStorage 仅作临时标识，配置持久化后端为 P0 待办（见 `doc/TODO.md`）。
- **不做的事**：不引入遥测/上报/外发请求；不侵入 HA 现有生产视图与实体。
- **插件体系（运行时）**：两条扩展路径——（1）**源码目录**（构建期，如 `thirdparty/<id>/`，需 `pnpm build`）；（2）**预编译插件包**（运行时，`<id>/plugin.json` + `index.js`，经市场「安装插件」导入，无需重建宿主）。插件复用宿主全局 `window.SnoozePanelPluginAPI`（含 Vue 运行时与 `registerFace`/`registerWidget`）；仅接受**同源 `/local` 目录与本地 `blob:`** 两通道，**不加载任意外网 URL**。上传限额前后端双重校验（单一常量源 `core/pluginLimits.ts` ↔ 后端 `const.py`）。详见 `doc/ARCHITECTURE.md` 决策 15/16 与 `doc/开发维护/第三方插件开发/`。
- **Shadow Root 托管与样式镜像（生产事故教训）**：HA 把 `panel_custom` 元素（`snooze-panel-sidebar`）与卡片编辑器元素托管在 `home-assistant-main` 的 **shadow root** 内，`document.head` 的样式（打包 CSS + PrimeVue 运行时样式）按 CSS Scoping 跨不过 shadow 边界 → 生产环境侧边栏/编辑器完全无样式（dev 实测台挂 light DOM 不复现，屏保全屏层挂 `document.body` 亦不受影响）。对策：元素自建 shadow root，`core/styleMirror.ts` 用 MutationObserver 把 head 中本项目打包 CSS（以 `styles/bundle.css` 的 loud 注释标记识别）与 PrimeVue 样式（`data-primevue-style-id` 属性识别）镜像进该 root。详见 `doc/ARCHITECTURE.md` 决策 17。
- **`/local` 31 天强缓存与版本查询串（发版红线）**：`/local` 静态产物 `cache-control` 为 `max-age` 31 天；`panel_custom` 的 `module_url` 与 lovelace 资源 URL **必须带版本查询串**（版本单一源 = `custom_components/snoozepanel/manifest.json`，后端 `_frontend_version()` 自动读取）。发版必须 bump 到**从未下发过**的版本串（复用旧串如 `?v=0.11.0` 仍命中旧缓存），且 lovelace 资源 URL 同步更新（WS `lovelace/resources/update`，键为 `resource_id`），改 `module_url` 需重启 HA 重新注册面板。

## 代码规范

- **全中文注释与文档**：代码注释、commit message、文档一律中文。
- **纯函数优先**：`src/core/` 下全部是无副作用纯函数，禁止 import 任何 DOM API；DOM/定时器/事件只能出现在 `src/runtime/`、`src/ui/`、`src/editor/`。
- **单文件 ≤ 520 行**：手写源码（`src/**`、`dev/**`、工程配置）单文件不得超过 520 行，超限须以模块化方式拆分；由 `eslint.config.js` 的 `max-lines` 规则强制（`pnpm lint` 会拦截）。
- **类型完备**：新增配置字段必须先在 `src/core/types.ts` 声明类型 + 在 `DEFAULT_CONFIG` 给默认值 + 在 `normalizeConfig` 做校验。
- **测试真实**：禁止伪造测试输出；单测必须真实跑过并把真实输出贴入自检报告。

## commit 规范

- 里程碑式 commit（骨架 / 核心层 / 运行时 / 编辑器 / 构建 / 文档），不追求每个小改动都提交。
- commit message 格式：`类型: 中文描述`，类型取 `feat/fix/chore/docs/test/refactor`。
- **最终交付前由用户确认是否 commit**，不擅自提交最终交付。

## 文档体系

```
doc/
├── ARCHITECTURE.md         # 架构决策取舍理由
├── TODO.md                 # 已知限制与路线（P0–P3）
├── 使用教程/
│   ├── 01-快速上手.md
│   ├── 02-进阶配置.md
│   └── 03-高级玩法.md
└── 开发维护/
    ├── 人类开发维护教程/
    │   ├── 01-环境搭建.md
    │   ├── 02-代码结构导读.md
    │   └── 03-发布与共建.md
    ├── 第三方表盘开发指南.md   # 表盘（时钟）开发契约（源码目录接入）
    ├── 第三方插件开发/         # 预编译插件包（运行时安装）：格式/SDK/开发/信任模型
    │   ├── 01-插件包格式与SDK.md
    │   ├── 02-表盘插件开发.md
    │   ├── 03-内容组件插件开发.md
    │   └── 04-安装与信任模型.md
    ├── 组件开发指南/           # 内容组件（widget）分级教程 + 接口规范
    │   ├── 01-基础篇/
    │   │   ├── 01-Hello-World组件.md
    │   │   ├── 02-目录契约与注册机制.md
    │   │   └── 03-主题与样式约定.md
    │   ├── 02-进阶篇/
    │   │   ├── 01-状态管理与响应式数据.md
    │   │   ├── 02-性能优化与动效.md
    │   │   └── 03-模块拆分与复用.md
    │   ├── 03-组件接口规范.md
    │   └── 04-专项指南/
    │       ├── 日历组件.md
    │       ├── 日期组件.md
    │       ├── 农历组件.md
    │       ├── 天气组件.md
    │       └── 自定义文本组件.md
    └── AI编程代理开发维护规范/
        ├── 01-代理工作规范.md
        ├── 02-符号级维护指南.md
        └── 03-验收与自检清单.md
```

AI 代理做维护任务前，**必读** `doc/开发维护/AI编程代理开发维护规范/01-代理工作规范.md` 与 `02-符号级维护指南.md`。
