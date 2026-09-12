# Changelog

本项目所有值得注意的变更都记录在此文件。
格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

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
