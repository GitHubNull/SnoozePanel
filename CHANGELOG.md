# Changelog

本项目所有值得注意的变更都记录在此文件。
格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

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
