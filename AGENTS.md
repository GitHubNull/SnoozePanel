# AGENTS.md — AI 编程代理入口规范

> 本文件是 AI 编程代理（Qoder / Cursor / Copilot 等）进入本仓库的**第一份必读文档**。
> 读完本文件再动手，能避免 90% 的方向性错误。

## 项目一句话

Home Assistant 仪表板屏保插件：视图 YAML 写 `snoozepanel:` 段即启用，闲置后全屏屏保（时钟/日历/农历/天气/自定义文本），触摸退出不刷新页面。

## 目录结构（严格遵守）

```
项目根/
├── src/                    # 唯一入库源码目录（.ts / .vue）
│   ├── main.ts             # 入口：注册 <snooze-panel> 与 <snooze-panel-editor>
│   ├── panel.ts            # SnoozePanelElement：hass setter / 视图配置读取 / 生命周期
│   ├── core/               # 纯函数核心层（无 DOM 依赖，全部可单测）
│   │   ├── types.ts        # SnoozeConfig 全量类型 + DEFAULT_CONFIG
│   │   ├── config.ts       # normalizeConfig：配置规范化/校验/默认值填充
│   │   ├── device.ts       # resolveDeviceId / isDeviceAllowed
│   │   ├── conditions.ts   # evalConditions：idle/entity/time/sun AND 求值
│   │   ├── lunar.ts        # solarToLunar / formatLunar（1900–2100 自包含位表）
│   │   ├── clock.ts        # 日历/周数/日期格式化
│   │   ├── template.ts     # evalTemplate：display_template 安全求值
│   │   ├── text.ts         # 实体占位符替换
│   │   └── hass.ts         # HassEntity 等 HA 类型
│   ├── runtime/            # 运行时层（DOM/定时器/事件）
│   │   ├── controller.ts   # SnoozeController：激活/退出状态机、闲置计时、冷却
│   │   ├── mount.ts        # mountScreensaver：Vue 子应用挂载/卸载
│   │   └── ticker.ts       # Ticker：1s tick，后台标签页暂停
│   ├── ui/                 # 屏保 UI
│   │   ├── ScreensaverApp.vue
│   │   ├── components/     # ClockDigital / ClockAnalog / CalendarView / LunarView / WeatherView / CustomText
│   │   └── themes.ts       # midnight / paper 两套主题
│   ├── editor/             # GUI 编辑器
│   │   ├── editor.ts       # SnoozePanelEditorElement（HA card editor 协议）
│   │   ├── EditorApp.vue   # PrimeVue 中文编辑器根
│   │   └── forms/          # 分区表单
│   └── tests/              # Vitest 单测（*.spec.ts）
├── doc/                    # 文档（见下方文档体系）
├── img/                    # 截图（README 引用）
├── tmp/                    # 唯一临时目录：工程文件/依赖/构建产物/缓存/日志全放这里
│   ├── package.json        # 工程清单（注意：在 tmp/ 下，不在根目录）
│   ├── vite.config.ts      # Vite lib 构建配置
│   ├── vitest.config.ts    # 测试配置
│   ├── tsconfig.json
│   ├── node_modules/       # pnpm 依赖
│   ├── dist/snoozepanel.js # 构建产物（单文件 IIFE）
│   └── dev/index.html      # 本地 mock 实测页
├── README.md
└── AGENTS.md               # 本文件
```

## 构建与测试命令

所有命令在 `tmp/` 目录下执行：

```bash
cd tmp
pnpm install          # 安装依赖（首次）
pnpm build            # 构建 → tmp/dist/snoozepanel.js
pnpm test             # 跑全部单测（Vitest）
pnpm test:watch       # watch 模式
```

本地 mock 实测：

```bash
cd tmp
python -m http.server 8765   # 或任意静态服务器
# 浏览器打开 http://127.0.0.1:8765/dev/
```

## 目录纪律（红线）

1. **`tmp/` 是唯一临时目录**：node_modules、构建产物、缓存、日志、dev 页全部放 `tmp/`，严禁在项目根或 `src/` 下新建临时文件。
2. **`src/` 只放入库源码**：`.ts` / `.vue`，禁止放测试快照、临时脚本、构建产物。
3. **工程文件在 `tmp/` 下**：`package.json` / `vite.config.ts` / `tsconfig.json` / `vitest.config.ts` 都在 `tmp/`，不在项目根。
4. **仓库根 `node_modules` 是 Junction**：指向 `tmp/node_modules`（为解决 src 在 vite root 外的依赖解析），不要删除或替换为真实目录。

## 安全红线（违反即返工）

- **令牌/密钥绝不入库**：`tmp/HA_info.txt`（生产令牌）、`tmp/HA_PROJECT_NOTES.md`（SSH 密钥路径+内网拓扑）、`tmp/tools/`、`tmp/ha_inventory/` 已在 `.gitignore`，严禁 `git add -f` 强制添加。
- **生产 HA 只读探测**：对生产环境（http://192.168.31.205:8123）只允许只读 API 调用；如需写入实测，必须在专用 `snoozepanel-test` 视图，完毕立即删除恢复原状。
- **不收集数据**：插件代码中严禁出现任何遥测、上报、外发请求。

## 代码规范

- **全中文注释与文档**：代码注释、commit message、文档一律中文。
- **纯函数优先**：`src/core/` 下全部是无副作用纯函数，禁止 import 任何 DOM API；DOM/定时器/事件只能出现在 `src/runtime/`、`src/ui/`、`src/editor/`。
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
    └── AI编程代理开发维护规范/
        ├── 01-代理工作规范.md
        ├── 02-符号级维护指南.md
        └── 03-验收与自检清单.md
```

AI 代理做维护任务前，**必读** `doc/开发维护/AI编程代理开发维护规范/01-代理工作规范.md` 与 `02-符号级维护指南.md`。
