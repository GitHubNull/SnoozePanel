# Changelog

本项目所有值得注意的变更都记录在此文件。
格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [0.11.3] - 2026-10-07 23:57:02

### Fixed
- 消除 HA 事件循环 blocking call 告警：`_frontend_version()` 在 `async_setup`（事件循环）中同步 `read_text` 读取 manifest，触发 `[homeassistant.util.loop]` Detected blocking call 告警（v0.11.2 生产日志两次复现）。修复：版本读取提前到模块导入期——重命名为 `_read_manifest_version()`，读取一次并缓存为模块级常量 `_MANIFEST_VERSION`；HA 在 import executor 线程导入 custom integration 模块，模块级同步 I/O 不在事件循环内执行，不再触发检测。文档 3 处引用同步更新（AGENTS.md / ARCHITECTURE.md 决策 17 / 03-发布与共建）

## [0.11.2] - 2026-10-07 22:34:33

### Fixed
- 侧边栏「SnoozePanel」入口图标永久空白：根因是 HA 侧边栏 `<ha-icon>` 仅在首次渲染时解析 `window.customIcons/customIconsets`，未命中即置 `_legacy=true` 渲染已废弃的 `<iron-icon>` 且永不重试；而产物此前作为 Lovelace 资源 / `panel_custom` `module_url` 加载均晚于侧边栏首渲。修复：前端产物改由集成目录自托管（`async_register_static_paths`，HA 2024.7+），并经 `frontend.add_extra_js_url` 随 HA 启动页 `<head>` 早期加载，图标集在侧边栏首渲前确定性注册（`panel_custom` `module_url` 与 extra_js 同 URL 按 URL 去重只加载一次；storage 模式仪表板 Lovelace 资源由集成自动登记/迁移，YAML 模式跳过）
- 配置页布局收缩为居中小盒：根因是 `SidebarApp.vue` 硬编码 `max-width:1200px` 与固定编辑器高度，且 `panel_custom` 自定义元素默认 `display:inline` 无高度链。修复：`sidebar.ts` 宿主 `display:block` + `calc(100dvh - 安全区)`、shadow 挂载点 `height:100%`；`SidebarApp.vue` 改全屏 flex 布局（`.editor-wrap` `flex:1; min-height:480px`），编辑器铺满剩余空间
- 配置页菜单浮层「一闪而过、无法点击」：根因是 `EditorMenuBar.toggleMenuPanel` 在 `nextTick` 中 `show(ev)`，此时 `ev.currentTarget` 已按 DOM 规范置 null，PrimeVue Popover 失去定位锚点抛 TypeError，浮层错位停显后随即被 outside-click 关闭。修复：事件派发期间同步捕获锚点 `show(ev, anchor)`；`show` 后嵌套一层 `nextTick` 再显式 `alignOverlay()`（避免 container 未挂载读 `undefined.style` 的 unhandled rejection，并覆盖同尺寸面板切换时 ResizeObserver 不触发的重对齐）；菜单按钮 `@click.stop` 隔离 document 级 outside-click 与 shadow DOM 重定向闪烁

### Added
- HACS 分发基建：仓库根 `hacs.json`（`zip_release` + `homeassistant: 2024.7.0`）+ `.github/workflows/release.yml`（push tag `v*` 触发：版本三处一致性校验 → `pnpm build` → 组装 `snoozepanel.zip` → 自动创建 Release）
- `manifest.json` 新增 `dependencies: ["frontend", "http", "lovelace", "websocket_api"]` 保证 setup 时序；`documentation` / `issue_tracker` 指向真实仓库

### Changed
- 安装方式变更：前端产物随集成一体分发（zip 根即集成文件 + `frontend/snoozepanel.js`），不再要求用户手动放 `www/` 与手动添加 Lovelace 资源；最低 HA 版本提升为 2024.7；`custom_components/snoozepanel/frontend/` 加入 `.gitignore` 与 ESLint 忽略（产物仅由 CI 注入 Release zip，不入库）
- 文档：安装章重写与故障排除新增三条（01-快速上手、README）、配置页布局与菜单栏说明（02-进阶配置）、ARCHITECTURE 新增决策 18（产物自托管 + 启动早期加载）与决策 19（浮层锚点同步捕获 + 双 nextTick + `@click.stop`）、发布流程改 CI（03-发布与共建）、代理规范常见坑新增三行

## [0.11.1] - 2026-10-07 21:19:13

### Fixed
- 侧边栏配置页 / 卡片编辑器在 HA 生产环境完全无样式（元素散落）：根因是 HA 把 `panel_custom`（`snooze-panel-sidebar`）与卡片编辑器元素托管在 `home-assistant-main` 的 shadow root 内，而本项目打包 CSS（`vite-plugin-css-injected-by-js` 注入 `document.head`）与 PrimeVue 运行时样式（`<style data-primevue-style-id>`）都在 `document.head`，按 CSS Scoping 规范跨不过 shadow 边界；dev 实测台挂 light DOM 故不复现，屏保全屏层挂 `document.body` 亦不受影响。新增 `src/core/styleMirror.ts`（`mirrorDocumentStylesInto` / `createStyledShadowHost`：为元素建自有 shadow root，用 `MutationObserver` 把 head 中本项目打包 CSS（loud 注释标记 `snoozepanel-bundle-css` + 兜底特征规则 `--snooze-bundle`）与 PrimeVue 懒加载样式增量镜像进该 root，按 head 顺序重排、卸载时清理）+ 标记文件 `src/styles/bundle.css`；`sidebar.ts` / `editor.ts` 挂载改为 `app.mount(shadowHost.host)`，`disconnectedCallback` 调 `destroy()`
- 前端产物缓存破除：`panel_custom` 的 `module_url` 追加版本查询串（`?v=<manifest.version>`，版本源自 `manifest.json` 单一口径）。`/local` 静态资源 `cache-control` 为 `max-age` 31 天，此前发版后浏览器长时间命中旧缓存

## [0.11.0] - 2026-09-13 01:34:39

### Added
- 表盘 / 组件市场元数据展示与详情页：全部内置表盘（6 款）与内置样式（5 类型）补齐 `author` / `version` / `summary` / `description` / `usage` / `homepage`；抽取共享组件 `src/editor/market/`（`MarketCard.vue` / `MarketDetail.vue`），`FaceMarketplace` 与 `WidgetMarketplace` 复用；卡片显示作者 + 版本徽标 + 简介，点击进详情页看详细介绍 / 使用指南 / 「使用此表盘·样式」/（第三方）卸载·禁用
- 元数据驱动属性面板：新增 `PropertyField` 类型（`src/ui/plugins/types.ts`）与 `PropertySchemaForm.vue`（按 `type` 渲染 color/number/boolean/select/text/textarea，按 `group` 分组，写回 `bind` 目标）；`useComponentSelection` 新增 `currentSchema` / `currentOptions` / `currentFields`；`PropertyPanel.vue` 硬编码参数区全部换为 schema 驱动；`CLOCK_TYPE_SCHEMA` / `WIDGET_TYPE_SCHEMA` 提供类型级默认 schema（内置顶层字段用 `bind:'field'`）
- 预编译插件包（app 式分发）：宿主全局 SDK `src/ui/plugins/sdk.ts`（`window.SnoozePanelPluginAPI`，暴露 Vue 运行时子集 + `core` 纯函数 + `registerFace`/`registerWidget`，`main.ts` 装机）；运行时注册表（`faces/registry.ts` / `widgets/registry.ts` 新增 `registerRuntimeFace/Widget` + `unregister` + `facesVersion`/`widgetsVersion` 响应式版本号，构建期与运行时合并视图）；运行时加载器 `src/runtime/pluginLoader.ts`（目录 `<script src="/local/...">` 与上传 `blob:` 两通道 + 注册结果校验）；前端封装 `src/core/pluginStore.ts`（`listPlugins`/`installPlugin`/`uninstallPlugin`/`setPluginEnabled`）
- 插件安装弹窗 `src/editor/PluginInstallDialog.vue`：市场工具栏「安装插件」打开，含「HA 本地目录」「文件上传」双 Tab，选择文件时即校验类型 / 大小 / 内容，安装前展示信任提示
- 插件上传限额与校验纯函数 `src/core/pluginLimits.ts`（前后端同口径）：类型白名单 + 大小上限（.js ≤ 512 KB、plugin.json ≤ 64 KB、单条 ≤ 1 MB）+ 数量上限（≤ 100）+ 内容校验（拒空 / NUL、id 正则、entry 禁路径穿越）
- 插件构建工具：顶层 `plugin-template/`（示例「像素时钟」）+ 根 `vite.plugin.config.ts`（IIFE + external vue → `SnoozePanelPluginAPI.vue`）+ `scripts/build-plugin.mjs`；`package.json` 新增 `build:plugin` / `build:plugin:examples`
- 后端插件存储（`custom_components/snoozepanel/`）：WS 命令 `list_plugins`/`install_plugin`/`uninstall_plugin`/`set_plugin_enabled`（`STORAGE_VERSION` 升为 2，存储结构扩为 `{devices, plugins}`），写入前以 voluptuous 严格 schema 做服务端强制限额校验（超限抛错不落盘）；后端仅存储不执行
- 文档：新增 `doc/开发维护/第三方插件开发/`（`01-插件包格式与SDK` / `02-表盘插件开发` / `03-内容组件插件开发` / `04-安装与信任模型`）；`ARCHITECTURE.md` 新增决策 15（运行时插件 SDK 与预编译插件包）、决策 16（元数据驱动属性面板 + 上传限额前后端双重防线）
- 测试：新增 `pluginLimits.spec.ts`（限额边界：恰好上限 / 超 1 字节 / 非法后缀 / NUL 等）与 `pluginRegistry.spec.ts`（运行时注册·同 id 覆盖·版本递增·反注册·bind 解析）
- dev 实测台：`dev/mock.js` 增插件分区与 4 条 WS 处理器（含限额校验）、dev 页面增插件列表与刷新；`tmp/plugins/` 示例产物路径

### Changed
- `registry.ts`（faces/widgets）改为「构建期 `import.meta.glob` + 运行时注册表」合并视图，市场弹窗 / 下拉 / 预览依赖 `facesVersion`/`widgetsVersion` 响应式刷新；`FaceMeta`/`WidgetStyleMeta` 与纯数据摘要扩元数据 + `schema` 字段
- `core/types.ts`：`ClockComponent` 增 `options?: Record<string, unknown>`；`core/config.ts` 的 `normalizeConfig` 为 clock 归一化 `options`；`ui/faces/types.ts` 的 `FaceProps` 增 `options`；`ScreensaverApp.vue` 时钟渲染透传 `config.components.clock.options`
- `ARCHITECTURE.md` 修订决策 10：将「拒绝运行时加载」限定为「拒绝**任意外部 URL**」，明确同源 `/local` 与本地 `blob:` 属允许范围（见决策 15）
- `TODO.md` P3「屏保皮肤/表盘市场」标注为部分落地（元数据+详情页+插件安装已实现，主题皮肤包与外网仓库下载未落地）
- `AGENTS.md` / `doc/开发维护/*`：同步新目录（`plugin-template/`、`scripts/`、`src/ui/plugins/`、`editor/market/`）、插件体系与构建命令，第三方表盘/组件开发指南补元数据与 schema 规范
- `eslint.config.js`：新增 `scripts/**/*.mjs` 的 Node 环境块并纳入 `max-lines` 约束

## [0.10.0] - 2026-09-13 00:22:00

### Added
- 顶部工具栏撤销 / 恢复：新增 `useEditorHistory`（快照 + 基线，300ms 防抖把拖拽 / 连续输入合并为单步，上限 50 步）；`useEditorDraft` 暴露 `isSyncing` 同步信号隔离 HA 回声；工具栏 `pi pi-undo` / `pi pi-redo` 按钮与 Ctrl/Cmd+Z、Ctrl/Cmd+Shift+Z、Ctrl/Cmd+Y 快捷键（`applying` / `isSyncing` 双守卫避免幽灵历史步）
- 对齐到屏幕（`core/align.ts` 新增 `screenAlignDeltas` + `useAlignmentActions.alignToScreen`）：以屏幕中心为基准，把选区外接框中心移到画布中心（水平 / 垂直 / 双向），选区各组件共享同一位移整体平移；工具栏对齐菜单新增三项 + Alt+Shift+C / M / E 快捷键
- 内容组件「类型 / 样式」两级体系（`src/ui/widgets/` 重构）：由「一类型一目录」改为 `widgets/<type>/<style>/`，每类型内置 3 款样式 + 编辑器弹窗 `WidgetMarketplace.vue` 按键切换；新增 `WidgetPreview.vue` 缩略预览（样例 options + mock hass + 1s Ticker）；`getWidget(type, style)` / `listWidgetStyles` / `listWidgetStyleOptions` 等对外 API
- 内容组件样式 15 款内置 + 5 款第三方样例：calendar(basic/compact/minimal + thirdparty fancy)、date(basic/badge/stacked + neon)、lunar(basic/pill/detail + seal)、weather(basic/card/inline + minimal)、text(basic/badge/quote + marquee)
- 配置字段：`CalendarComponent` / `DateComponent` / `LunarComponent` / `WeatherComponent` / `TextComponent` 新增 `style`（`DEFAULT_CONFIG` + `normalizeConfig` 三步走，缺省归一为 `'basic'`）
- 文档：新增 `doc/开发维护/第三方组件开发指南.md`；重写 `组件开发指南/01-基础篇/02-目录契约与注册机制.md`（类型 / 样式两级）
- 测试：新增 `editorHistory.spec.ts`；扩展 `align.spec.ts`（`screenAlignDeltas`）；重写 `widgets.spec.ts`（每类型 4 样式 + 遍历全部样式挂载）；`config.spec.ts` 补风格归一用例

### Changed
- `ScreensaverApp.vue`：`PlacedComp` 增加 `style`，内容组件按 `getWidget(type, style)` 动态挂载（时钟仍走 faces 表盘）
- `useComponentSelection.ts`：新增 `currentWidgetType` / `currentStyle` 派生读写（供属性面板 / 弹窗联动）
- `PropertyPanel.vue`：日历 / 日期 / 农历 / 天气 / 单条文本属性块顶部新增「样式选择卡片」（点击进入样式选择器）
- `useEditorDraft.ts` 返回值改为 `{ draft, isSyncing }`；`editorContext.ts` 的 `EditorActions` 增加 `history`

## [0.9.0] - 2026-09-13 00:01:10

### Added
- 内容组件插件化体系（`src/ui/widgets/`）：`registry.ts`（import.meta.glob 构建时自动收集，第三方同 id 覆盖内置）+ `types.ts`（WidgetProps 统一 props）；每个组件一个目录（`widgets/<id>/index.vue` + 可选 `widget.meta.ts`），第三方放 `widgets/thirdparty/<id>/`；原四个硬编码组件迁移为内置 widgets（calendar/date/lunar/weather/text）
- 新增「日期」内容组件（`widgets/date/`）：ISO 8601 占位符格式模板（YYYY/YY/MM/M/DD/D/dddd/ddd，`formatDate` 新增 YY 两位年），编辑器属性面板可编辑模板（默认关闭，默认模板 `YYYY年MM月DD日 dddd`）
- 编辑器多选：`selectedKeys` 选中集合（Ctrl/Cmd/Shift 增量多选）+ 主选中语义（最后选中项供属性面板主体）+ 画布/分类面板多选高亮与「已选 N 项」提示
- 对齐 / 分布（`core/align.ts` 纯函数 + `useAlignmentActions`）：以选区外接框为基准的六向对齐（左/右/水平居中/顶/底/垂直居中）与水平/垂直平均分布（首尾不动）；按可见内容盒量测、位移夹取写回 `layout.x/y`
- 图层（`core/layers.ts` 纯函数 + `useLayerActions`）：置顶/置底/上移/下移 + z 密集序规范化（0..n-1）；`layout.z` 字段（可选，夹取 0-999），ScreensaverApp 按 z 升序渲染叠放
- 顶部工具条（`TopToolbar.vue`）：菜单栏与工作区之间「对齐」「图层」两个 PrimeVue 弹出菜单（图标 + 中文 + 快捷键提示，按选中数禁用）
- 编辑器快捷键（`useEditorShortcuts`）：Alt+L/C/R/T/M/B 对齐、Alt+H/V 分布、Ctrl+[ / Ctrl+] 置底/置顶、Ctrl+Shift 上移/下移一层；焦点在输入态时自动屏蔽
- 组件配置透传：五类组件新增 `options` 字段（JSON 安全对象浅拷贝），供第三方组件消费自定义配置
- 文档：新增 `doc/开发维护/组件开发指南/`（基础篇 ×3 / 进阶篇 ×3 / 接口规范 / 专项指南 ×5，共 12 篇）
- 测试：新增 `align.spec.ts` / `layers.spec.ts` / `widgets.spec.ts`；`config.spec.ts` 补 date 规范化、`layout.z` 夹取、`options` 透传用例

### Changed
- `ScreensaverApp` 组件渲染重构：删除 `CalendarView`/`LunarView`/`WeatherView`/`CustomText` 四个硬编码分支，统一经 widgets 注册表动态挂载（非 clock 组件一律走 `<component :is>` + `options`）
- 编辑器选中态全链路迁移：单值 `selected` → `selectedKeys` 数组（EditorApp / CategoryPanel / EditorCanvas / DevicePreview / ComponentWrapper，`select` 事件带 `additive` 标志）
- `ComponentWrapper` 新增 `zIndex` 属性（写入 z-index 控制堆叠）
- `AGENTS.md` 与 AI 维护规范（符号表 / 验收清单）同步 widgets 体系、对齐/图层符号与新场景指引

## [0.8.0] - 2026-09-12 23:13:58

### Added
- 画布外挂标尺（`core/ruler.ts` 纯函数 + `ScreenRulers.vue`）：模拟屏幕左缘/下缘纵、横两把标尺（0 点在屏幕左下角，向上/向右递增），随预览同步缩放；刻度采用「nice step」策略（1/2/5×10ⁿ 档位，主刻度 8 段目标 + 5 等分次刻度），单位可切换分辨率(px)/厘米/毫米（1 英寸 = 96 CSS 参考像素）
- DevicePreview 标尺槽：左侧/底部各预留 22px 标尺槽，新增 `.device-scaled` 缩放层包裹机身与标尺使二者同步缩放（fit/percent 的适配与滚动尺寸均纳入标尺槽）
- 编辑器恒定暗色外观（`chromeTheme.ts` + `--sp-chrome-*` 六令牌，PS6 风格暗灰）：挂载时按引用计数将 `.snooze-editor-dark` 类加到 `documentElement`，使 teleport 到 body 的 Popover / Dialog / Toast 共用深色令牌；多宿主（卡片编辑器/侧边栏）共存安全
- 画布工具条新增标尺开关与单位选择；`useEditorLayout` 新增 ruler 偏好（show 默认开启 + unit，非法值回退）
- 测试：新增 `ruler.spec.ts`（nice step 刻度 / px·cm·mm 换算 / 边界防护）

### Changed
- 编辑器全部组件与样式（五区子组件 / editor.css / panel.css / FaceMarketplace / SidebarApp）的 HA 主题变量（`--card-background-color` 等）替换为 `--sp-chrome-*` 恒定暗色令牌，不随 HA 浅色主题呈现大片亮底
- `EditorApp` 外壳底色改为 `--sp-chrome-bg`（恒定暗色），挂载/卸载时获取/释放暗色外观

## [0.7.0] - 2026-09-12 22:44:54

### Added
- 编辑器设备模拟面板（`DevicePreview.vue` / `runtime/devicePreview.ts`）：按目标设备尺寸（模拟视口）渲染屏保再等比缩放适配，语义等价 Chrome DevTools 设备模拟——屏幕区布局尺寸恒为目标设备 CSS px，屏保根 `container-type: size` 使 `cqmin/cqw` 按设备视口解析（与真机逐像素一致），缩放仅作用于视觉（transform），编辑态拖拽/缩放数学自洽
- 机身外框：屏幕四周包裹金属边框模拟真机平放桌面的俯视效果，边框厚度/圆角随形态（手表/手机/平板）变化
- 屏幕尺寸预设（`core/screen.ts`）：方形手表 360/454、全面屏手机 390/430、平板 1024×768/1280×800 + 自定义宽高（夹取 120–4096 px）；`ScreenSize` 随 `SnoozeConfig` 持久化（生产屏保始终全屏，仅影响预览）
- 画布浮动工具条（`CanvasToolbar.vue`）：网格 / 屏幕尺寸 / 缩放适配三组控件，支持停靠四边（拖动就近吸附）、水平/垂直排列、可收起（默认收起）
- 缩放适配：fit 自动适配 + 固定百分比（16 档预设，类 Chrome 缩放；硬约束 >0 且 <500）；停靠/排列/收起/缩放档均为 UI 偏好持久化
- 测试：新增 `screen.spec.ts`（预设匹配/夹取/自洽解析）与 `zoom.spec.ts`；`config.spec.ts` 新增 screen 规范化用例
- 补充（随本版本发布）：仓库新增 `LICENSE`（MIT 协议）与 `DISCLAIMER.md`（法律免责声明）

### Changed
- 全量容器查询单位迁移：7 款表盘与 5 个组件的 `vw/vmin` 改为 `cqw/cqmin`，`ScreensaverApp` / `FacePreview` 舞台加 `container-type: size`——生产全屏下 `cqmin === vmin` 观感不变，编辑器内按设备视口真实解析
- `EditorCanvas.vue` 重构：内联配置条迁移为 CanvasToolbar + DevicePreview 组合；屏幕尺寸写入草稿（随配置持久化），缩放档位来自 UI 偏好
- `useEditorLayout` 新增 toolbar / zoom 偏好（停靠边/排列方向/收起态/缩放档）与 `clampZoomPercent` 硬约束
- `CategoryPanel` 选中态样式修复：实心蓝底 + 高光滤镜会把开关冲成纯白 → 浅色底 + 内描边 + 加粗
- README：新增「编辑器设备模拟面板」截图（平板/手机/手表三机型）与画布预览说明

## [0.6.0] - 2026-09-12 21:26:33

### Added
- HA 自定义图标集（`src/runtime/iconset.ts`）：注册 `snoozepanel` 前缀（单色卧月 + 星芒字形），供 HA 侧边栏以 `snoozepanel:logo` 显示品牌图标；由 `main.ts` 在产物加载时注册，纯注册逻辑、无副作用、零外发请求
- 品牌视觉资产：`img/banner.png` / `img/banner.svg`（README 头图）、`img/logo.svg`（彩色品牌标，dev 页 favicon 与标题使用）
- README 截图体系重构：本地实测台（首屏 / 编辑器 / 表盘市场 / 运行时状态与日志）+ 屏保表盘 × 主题（数字时钟 / 机械计时码表 / 轨道同心圆 / 宣纸模拟）+ HA 侧配置编辑器

### Changed
- HA 侧边栏图标由 `mdi:sleep` 改为 `snoozepanel:logo`（`__init__.py` 附回退说明：未加载图标集的环境可改回任意 `mdi:` 图标）
- dev 实测台品牌化：favicon 由内联空图标改为 `img/logo.svg`，顶栏标题加入品牌 logo（含 slim 态尺寸适配）
- README 更新：顶部新增品牌头图，重制 dev-page / editor-gui / screensaver-digital-midnight 三图并新增侧边栏图标说明

## [0.5.0] - 2026-09-12 20:47:25

### Added
- 首个第三方表盘「潜水表」（`src/ui/faces/thirdparty/diver/`）：钢壳 + 陶瓷单向旋转表圈（60 分钟刻度 + 12 点夜光珠）+ 夜光时标（12 点三角 / 6·9 点长棒）+ 3 点位日期窗 + 剑形指针 + 棒棒糖秒针；按 `theme.key` 派生钢/夜光配色（午夜 = 冷钢高亮夜光，宣纸 = 暖钢收敛夜光），组件拆为 DiverBezel / DiverHands / palette.ts
- `doc/开发维护/第三方表盘开发指南.md`：目录契约（放入 `thirdparty/<id>/` 即自动注册）、FaceProps、`face.meta.ts` 字段、主题接入（`theme.key`）、动效约定（纯 CSS + reduced-motion 回退）、SVG defs 唯一性（`useId` 前缀）、验证机制与自检清单
- `Theme.key` 字段（`'midnight' | 'paper'`）：表盘据此可靠区分配色，不再依赖中文显示名
- 测试：`faces.spec.ts` 新增第三方注册/渲染断言（内置恰好 6 款按 `source` 分组、第三方含 `diver`、双主题渲染）；`drag.spec.ts` 等既有用例不变

### Changed
- chrono 表盘主题化金属升级：表圈按 `theme.key` 切换（午夜 = 暖玫瑰金 / 宣纸 = 古铜深金），新增镜面高光、日内瓦环形纹理、边缘暗角与拉丝多段渐变
- chrono 齿轮组改为纯 CSS 关键帧匀速传动（原为 1s tick 逐帧重算）：传动比按齿数推导（18T 60s 正转 / 12T 40s 反转 / 10T 33.33s 正转），共用相位偏移保证齿牙啮合；`prefers-reduced-motion: reduce` 下停转
- chrono 星期子表盘由 SUN–SAT 改为中文「日~六」；指针增夜光内嵌线/抛光高光，秒针加尾部配重，子表盘指针改锥形配重并带平滑扫动过渡
- chrono / diver 全部 `<defs>` id 加 `useId()` 实例前缀（市场预览 + 全屏多实例同时挂载不串色），`faces.spec.ts` 断言同步更新
- 文档同步：进阶配置（chrono 描述 + 第三方表盘章节）、代码结构导读（registry 双 glob / 新增表盘步骤）、验收自检清单（齿轮动效 / 第三方市场与双主题检查项）

## [0.4.1] - 2026-09-12 20:18:03

### Added
- 模块化强制约束：ESLint `max-lines: 520` 规则——手写源码（`src/**/*.{ts,vue}` / `dev/**/*.js` / 工程配置）单文件不得超过 520 行，`pnpm lint` 违规即报错（超限须以模块化方式拆分）
- `src/editor/editorContext.ts`：编辑器三份跨区共享上下文（草稿 / UI 偏好 / 选中态）的 provide/inject 注入键与 helper
- `src/editor/components/`：五区子组件拆分（EditorMenuBar / CategoryPanel / EditorCanvas / PropertyPanel / StatusBar）
- `src/editor/composables/`：组合式函数抽取（useEditorDraft 草稿与回声防护 / useComponentSelection 选中态派生 / useDeviceSave 设备级保存）
- `src/editor/editor.css`：编辑器五区共享样式（子组件以 `<style scoped src>` 复用）
- dev 实测页同目录 ES 模块拆分：`types / constants / state / log / mock / bundle / config / editor / runtime / layout.js`
- ARCHITECTURE 决策 14：模块化拆分与 520 行强制约束的理由与落地方式

### Changed
- `src/editor/EditorApp.vue` 由原约 1350 行重构为瘦编排层（263 行，组织五区子组件 + Toast + 表盘市场）
- `dev/dev.js` 由原约 900 行重构为瘦入口（106 行，仅事件绑定与启动编排）；可变运行时状态收敛到 `state.js` 单一对象承载（ESM 导入绑定只读，跨模块 `let` 重赋值不生效）
- `tsconfig.dev.json` 类型检查范围由 `dev/dev.js` 扩展为 `dev/**/*.js`
- AGENTS.md 目录结构与代码规范更新（单文件 ≤520 行红线），README 与 AI 代理规范 / 人类教程文档同步

## [0.4.0] - 2026-09-12 19:38:36

### Added
- 编辑器五区布局：插件菜单栏 / 组件分类区 / 画布 / 属性区 / 状态栏，多宿主（HA 卡片弹窗、侧边栏、dev 实测台）呈现同一套布局
- 画布网格与磁吸附对齐：默认显示网格（双轴 1px 渐变 + `background-size` 步长%）并默认开启磁吸，边缘接近网格线时显示参考线；网格层仅编辑态渲染
- 文本组件显示开关：`TextComponent.show`（缺省视为显示，兼容旧配置；关闭后屏保不渲染该项）
- `useEditorLayout`：面板宽度/收起态与画布网格/磁吸偏好统一读写（localStorage，纯 UI 偏好，不涉及配置资产）
- 测试：`drag.spec.ts` 新增 `snapEdges` 吸附用例（阈值触发 / 多边缘取最近 / 关闭 / NaN 防护），`config.spec.ts` 新增 texts `show` 缺省用例

### Changed
- `EditorApp.vue` 重构拆分：全局配置浮层拆为 `src/editor/panels/`（Basic / Appearance / Conditions / Device / Advanced + panel.css）；删除 `TextsForm.vue`（并入属性面板）
- `drag.ts` 新增手势 `onStart` 回调（供调用方量测几何）与 `snapEdges` 吸附纯函数（吸附在 clamp 之后执行，不越界）
- `ScreensaverApp.vue` 编辑态渲染网格层 / 吸附参考线 / 点选联动
- `SidebarApp.vue` 适配五区外壳（max-width 1200px、显式高度避免塌陷）
- dev 实测台与文档同步：ARCHITECTURE 决策 13、AGENTS 目录结构、符号级维护指南、代码结构导读

## [0.3.1] - 2026-09-12 17:24:57

### Added
- 组件内容等比缩放：`ComponentWrapper` 新增内容层（`transform: scale()`），以 `baseWidthFor`（组件默认布局宽）为「1x」基准，布局宽与基准比值即缩放比；缩放手柄反向缩放、屏幕尺寸恒 16px
- 编辑器预览画布接入真实 `Ticker`，时钟秒级实时刷新
- dev 实测页新增「未应用变更」徽标（编辑器配置与最近应用快照对比提示）
- 新增 `src/tests/drag.spec.ts`：`computeResize` 轴向/等比缩放与边界防护单测

### Changed
- `makeResizable` 抽出纯函数 `computeResize`，支持 `lockAspect` 等比模式（任意方向拖拽手柄等比缩放）
- 编辑态虚线框与缩放手柄改依附内容层，虚线框恒等于组件内容边界
- dev 实测页配置以编辑器为单一来源（挂载/重新应用均读取编辑器当前配置）
- 移除 `mountScreensaverPreview`（`preview.ts` / `main.ts` / dev 页）
- `FacePreview` 撑满宿主容器（`width/height: 100%`）

### Fixed
- 修复组件字体颜色「改不了」：PrimeVue ColorPicker 输出裸 hex（无 `#`），新增 `attachHexHash` 补全（编辑器 / 文本表单 / `normalizeColor` 容错）
- 修复编辑配置后触发屏保仍沿用首次配置：`setConfig` 对运行中控制器热同步（含设备级覆盖缓存）
- 修复缩放手柄在组件缩小时难以抓取、虚线框小于组件内容（手柄恒定 16px、虚线框随内容缩放）

## [0.3.0] - 2026-09-12 16:11:05

### Added
- 侧边栏导航入口：后端注册 `panel_custom`（`snooze-panel-sidebar`，mdi:sleep 图标），新增 `src/sidebar/` 全页配置界面（`SidebarApp.vue` + `sidebar.ts`）
- 自由布局系统：`ComponentLayout`（x/y/w/h 百分比）取代旧九宫格定位，新增 `src/runtime/drag.ts` 拖拽/缩放手势封装与 `src/ui/components/ComponentWrapper.vue` 组件包装器
- 组件自定义字体颜色：组件配置新增 `color` 字段（`normalizeColor` 校验，非法值回退主题色）
- 沉浸式表盘市场：新增 `src/editor/FaceMarketplace.vue`（全屏模态、来源分类 Tab、卡片实时预览）；表盘注册表新增 `source` 来源标记与 `faces/thirdparty/` 第三方扫描
- 编辑器三栏布局（组件列表 / 预览画布 / 属性面板），支持画布内拖拽布局编辑与颜色选择
- dev 实测页内嵌真实编辑器（TestApi 新增 `mountEditor` / `mountScreensaverPreview`），与 HA 环境配置体验一致

### Changed
- `ScreensaverApp.vue` 统一由 `ComponentWrapper` 渲染（移除九宫格/绝对定位双轨逻辑）
- 配置 `position` 字段（grid/absolute）被 `layout` 取代；旧配置含 `position` 时忽略并回退默认布局
- 自定义文本表单支持逐条布局（X/Y/宽）与颜色配置

### Fixed
- 修复屏保激活后未初始化退出冷却导致首个触摸即退出（激活时立即应用 `exit_cooldown_seconds`）
- 修复表盘市场 Dialog 无法打开（移除 `visible` watcher 引发的挂载即卸载）
- `.gitignore` 补充 `.qoder/`（IDE 工作目录）

## [0.2.0] - 2026-09-12 12:41:08

### Added
- 插件式表盘框架（`src/ui/faces/`）：基于 `import.meta.glob` 的注册表，内置 6 款表盘（digital / analog / minimal / ring / orbit / chrono）
- HA custom component 后端（`custom_components/snoozepanel/`）：`snoozepanel/get_config`、`snoozepanel/set_config` WebSocket API，设备级配置落盘 `.storage/`，断电重启不丢失
- 前端设备级配置存储层 `src/core/store.ts`：WebSocket 优先 + YAML 降级读写
- 表盘实时缩略预览：`FacePreview.vue` 组件与 `mountFacePreview()` 挂载封装，dev 实测页与编辑器共用
- dev 实测页逻辑模块 `dev/dev.js`（JSDoc 类型化，经 `tsconfig.dev.json` 检查）
- 编辑器新增设备级配置分区，表盘下拉支持实时预览
- 工程化工具链：ESLint 10 flat config、vue-tsc 类型检查（`typecheck` / `typecheck:dev` / `lint` 脚本）

### Changed
- `ScreensaverApp.vue` 改为按表盘 id 动态解析渲染组件
- 配置项 `clock.style` 直接透传表盘 id（非法值回退 digital）
- 文档体系同步更新：架构决策、使用教程、维护规范、验收清单

### Removed
- 移除硬编码表盘 `ClockDigital.vue` / `ClockAnalog.vue`（由表盘框架取代）

### Fixed
- 修复 dev 页与编辑器的类型错误及 ESLint 警告（全量零告警）
- 修复 PrimeVue v4 表盘下拉浮层样式与高度问题
- `.gitignore` 补充 Python 缓存规则（`__pycache__/`、`*.py[cod]`）
