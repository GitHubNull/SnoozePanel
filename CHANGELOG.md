# Changelog

本项目所有值得注意的变更都记录在此文件。
格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

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
