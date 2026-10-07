# ARCHITECTURE.md — 架构决策与取舍

> 记录 SnoozePanel 关键架构决策的**理由、备选方案与放弃原因**。
> 读这份文档能回答「为什么是这么实现的」，而不是「是怎么实现的」。

## 决策 1：载体 = custom panel 元素 + 视图级门控

**结论**：注册 `<snooze-panel>` 自定义元素；视图启用 = 视图 raw YAML 含 `snoozepanel:` 段 + 视图底部一个不可见卡片（`type: custom:snooze-panel`）。

**理由**：
- HA 前端**唯一**可靠的视图级按需注入机制是 custom card。HA 没有 view 级 plugin/editor API。
- 卡片自身 `render()` 返回空，肉眼不可见，仅作为「配置锚点」与「生命周期载体」。
- 无此卡片的视图：元素根本不会被实例化，零加载零副作用。

**备选方案**：
- ❌ 全局 panel（`panel_custom`）：无法按视图差异化配置，且会污染所有视图。
- ❌ 劫持 `ll-custom-card` 或 monkey-patch `hui-view`：HA 内部 API 无版本契约，升级即碎。
- ❌ 浏览器端 userscript：脱离 HA 生态，无法读 hass 对象。

## 决策 2：激活控制器单例 + capture 监听

**结论**：`SnoozeController` 单例；capture 阶段监听 `pointerdown` / `touchstart` / `keydown` + `location-changed` 重置闲置计时；`visibilitychange` 暂停 ticker。

**理由**：
- capture 阶段能在事件被业务卡片 `stopPropagation` 前捕获，保证「任何交互都算活动」。
- `location-changed` 是 HA 前端路由切换事件，切换视图必须重置闲置计时，否则刚切过去就触发屏保。
- `visibilitychange` 暂停 ticker：后台标签页不计时、不渲染，省平板电量。

**备选方案**：
- ❌ bubble 阶段监听：被卡片拦截后收不到，闲置计时永远不失效。
- ❌ 轮询 `document.hasFocus()`：无法捕获「用户在看但没操作」与「用户在操作」的区别。

## 决策 3：屏保挂载 = body 级全屏 fixed 容器 + Vue 子应用

**结论**：激活时向 `document.body` append 全屏 fixed 容器，容器内挂独立 Vue 子应用；退出时 `app.unmount()` + 移除容器 + 清空全部 timer/监听器。

**理由**：
- 屏保需要盖住整个视口（含 HA 侧边栏/顶栏），必须脱离卡片 DOM 树。
- 独立 Vue 子应用（而非复用 HA 的 Vue 实例）：HA 前端不暴露 Vue，且版本可能冲突；自包含打包最稳。
- 退出时彻底卸载：防止定时器/监听器泄漏导致平板长时间运行卡顿。

**备选方案**：
- ❌ 在卡片 shadow DOM 内渲染：盖不住 HA 原生 UI。
- ❌ 用 HA 的 `more-info` dialog：样式不可控，且会触发 HA 内部状态。

## 决策 4：模板求值 = new Function + try/catch 降级

**结论**：`display_template` 用 `new Function('hass','states','user', body)`，try/catch 包裹，异常 → 该组件恒显示 + `console.warn` 一次（Set 去重防刷屏）。

**理由**：
- HA 用户熟悉 Jinja2，但前端无 Jinja2 运行时；JS 表达式是前端唯一零依赖方案。
- 优雅降级：模板写错不应导致屏保白屏，恒显示是最安全的兜底。
- warn 一次而非每次：避免条件 5s 重估时控制台刷屏。

**备选方案**：
- ❌ `eval`：无法注入作用域，污染全局。
- ❌ 引入 Jinja2 JS 移植版：增加 100KB+ 体积，收益不成比例。
- ❌ 模板异常 → 组件隐藏：用户写错模板会导致组件神秘消失，排查困难。

## 决策 5：农历 = 内置 1900–2100 压缩位表

**结论**：内置 201 个 int 的位表（每年一个：bit0-3 闰月月份、bit4-15 各月大小、bit16 闰月大小），纯函数 `solarToLunar(date)`，零依赖。

**理由**：
- 农历无简单公式，必须查表；1900–2100 覆盖 HA 用户全部有生之年。
- 压缩位表仅约 800 字节，远小于任何第三方农历库（lunar-javascript 约 60KB）。
- 纯函数可单测：锚点（2000-01-01、2024-02-10 春节、闰月年、1900/2100 边界）全部验证通过。

**备选方案**：
- ❌ 引入 lunar-javascript：体积大 75 倍，且 HA 插件应自包含。
- ❌ 调用 HA 后端农历传感器：增加实体依赖，屏保不应依赖额外配置。

## 决策 6：设备 id = URL 参数 > localStorage 自动生成

**结论**：`?snooze_device=xxx` > `localStorage['snoozepanel-device']` 自动生成 `dev-xxxxxx`；屏保右下角小字显示设备 id 便于复制到白/黑名单。

**理由**：
- 多平板场景：厨房/客厅/卧室平板需要差异化配置（如厨房不显示农历）。
- URL 参数优先：HA 平板通常用 Fully Kiosk 等 App 固定 URL，把设备 id 写进 URL 最稳定。
- localStorage 兜底：浏览器首次访问自动生成，用户无需手动配置。
- 屏保角落显示：用户配置白名单时能直接抄，不用开 DevTools。

**备选方案**：
- ❌ 用 HA 的 `device_id`（浏览器指纹）：HA 未暴露稳定设备标识给前端。
- ❌ 仅用 localStorage：清缓存后设备 id 变化，白名单失效。

## 决策 7：构建 = Vite lib 模式单文件 IIFE

**结论**：Vite lib 模式，入口 `src/main.ts`，`inlineDynamicImports` + `cssCodeSplit:false` + `vite-plugin-css-injected-by-js`，产物单文件 `snoozepanel.js`（IIFE），Vue/PrimeVue 全部打包。

**理由**：
- HA「资源」机制只接受单个 JS 文件 URL，不接受 ES module 的相对 import。
- HA 前端无 Vue，必须自包含打包（当前产物约 686KB，gzip 约 171KB，可接受）。
- CSS 注入 JS：避免 HA 资源机制还要额外配 CSS 文件。
- IIFE 而非 ESM：HA 旧版本对 ESM 资源支持不一致，IIFE 兼容性最好。

**备选方案**：
- ❌ ES module + importmap：HA 资源机制不支持 importmap。
- ❌ 外置 Vue CDN：违背自包含原则，且内网环境可能无 CDN。

## 决策 8：目录纪律 = 工程文件在项目根，tmp/ 仅放临时文件

**结论**：`package.json` / `pnpm-lock.yaml` / `vite.config.ts` / `vitest.config.ts` / `tsconfig.json` / `node_modules/` 全部位于**项目根**，遵循常规 Node 项目结构；`dev/` 承载 mock 实测页（**必须入库**，供他人测试/核对/验证）；`tmp/` 只承载可丢弃的临时文件（构建产物 `tmp/dist/`、验证截图、一次性辅助脚本、垃圾/测试数据、敏感信息），整体被 `.gitignore` 排除；`src/` 仅 `.ts`/`.vue` 源码。

**理由**：
- 工程文件放项目根是 Node 生态的通用约定：任何开发者、AI 代理或 CI 打开仓库即懂，无需额外心智负担。
- `tmp/` 回归它的字面含义——临时目录，只放可随时删除、不入库的产物。
- git 追踪的依然只有源码/文档/截图，仓库根保持干净。

**曾走过的弯路（已废弃）**：早期曾把 `package.json` 等工程文件全部塞进 `tmp/`，并用仓库根 `node_modules` Junction 转发到 `tmp/node_modules` 来解决依赖解析。该方案非常规、反直觉，且依赖 pnpm 虚拟 store 的路径绑定（目录一旦移动就需重装，实际已踩坑）。**已放弃**。

**备选方案**：
- ❌ 工程文件放 `tmp/`：反常规，违反用户明确纠正，已废弃。
- ❌ 把 `src/` 移进 `tmp/`：违反「src/ 仅入库源码」约束。

## 决策 9：配置持久化 = HA 后端 component + 视图级 lovelace 存储

**结论**：配置分两层持久化——**视图级**配置写进视图 raw YAML 的 `snoozepanel:` 段，随 HA lovelace 存储天然持久化；**设备级**配置记录（每台平板各自的设置、白/黑名单等）**必须落盘到 HA 后端**（custom component 暴露 WebSocket API，存储于 HA `.storage/`），前端只做读写调用。

**理由**：
- 屏保配置是用户资产，必须跨重启存活：HA 服务重启、浏览器清缓存、换用其他 App/设备都不能丢配置。
- 仅靠浏览器端持久化（`localStorage` / `sessionStorage` / `IndexedDB`）无法满足：清缓存即丢，且无法在多设备间共享「每台设备配置记录」。
- 仅有视图级 YAML 也不够：视图 YAML 是「视图配置」，无法承载「每台平板各自的运行时配置记录」。
- HA 插件生态的标准做法就是后端 custom component + `.storage/` 持久化，前端通过 `hass.callWS()` 读写。

**实现边界**：
- 前端：统一封装配置读写（优先走后端 WS API；后端不可用时降级为视图 YAML 只读 + console 提示），**严禁把 localStorage 当作配置的权威存储**。
- 后端：custom component 提供 `snoozepanel/get_config` / `snoozepanel/set_config` 等 WS 命令，按 `device_id` 分区存储。

**备选方案**：
- ❌ 仅用浏览器 localStorage：清缓存/换 App 即丢，不可接受。
- ❌ 仅用视图 YAML：无法承载每台设备的独立配置记录。
- ❌ 复用 `input_text` 等 HA helper 存配置：侵入用户实体列表，且容量/结构受限。

**当前状态**：已实现。后端 `custom_components/snoozepanel/` 提供 WS API（`snoozepanel/get_config` / `set_config` / `list_devices` / `delete_config`），设备级配置按 `device_id` 分区存于 HA `.storage/snoozepanel`（`Store` 原子写、跨重启存活）；前端 `src/core/store.ts` 封装读写（WS 优先 + 视图 YAML 降级），`panel.ts` 启动控制器前加载设备覆盖并 `mergeConfig` 合并。

**WS API 与存储模型**：
- `snoozepanel/get_config` `{device_id}` → `{config: object|null}`
- `snoozepanel/set_config` `{device_id, config}` → `{success: true}`
- `snoozepanel/list_devices` → `{devices: string[]}`；`snoozepanel/delete_config` `{device_id}` → `{success: bool}`
- 存储结构：`{"devices": {"<device_id>": {<设备级配置覆盖>}}}`；设备级只存覆盖项，与视图 YAML 合并时覆盖优先。

## 决策 10：表盘框架 = 表盘即目录 + 构建时 import.meta.glob 收集

**结论**：时钟从硬编码 `digital`/`analog` 二选一升级为可扩展表盘框架。每个表盘是 `src/ui/faces/<id>/` 一个目录（`index.vue` 入口 + 可选子组件/`face.meta.ts`），用 Vite `import.meta.glob('./faces/*/index.vue', { eager: true })` 在**构建时**收集进单文件 IIFE 产物；`faces/registry.ts` 导出 `getFace`/`listFaces`；`ClockComponent.style` 由枚举改为表盘 id（`string`）；`ScreensaverApp.vue` 用 `<component :is>` 按 id 动态渲染。

**理由**：
- 用户要求表盘「多文件组合、可维护」——复杂表盘（如机械计时码表 chrono）需拆成齿轮组/子表盘/指针组多个子组件，单文件不可维护。
- 产物必须是单文件（HA 资源机制只接受单 JS），且红线禁止运行时外发请求——`import.meta.glob` 让「多文件组合」与「单文件产物」兼得，「导入新表盘 = 放目录重新 build」，无需改注册代码。
- 统一表盘 props 接口 `FaceProps`（`now/seconds/hour24/theme`），屏保根统一传参，表盘自包含配色。
- 项目早期无历史用户，`style` 直接重定义为表盘 id，不做向后兼容（core 层宽松透传，渲染层 `getFace` 兑底回退 `digital`）。

**备选方案**：
- ❌ 表盘从**任意外部 URL** 运行时加载：违反「不外发请求」红线，且单文件产物不允许（注：**同源 `/local` 目录与本地 `blob:` 的运行时加载属允许范围**，见决策 15）。
- ❌ 表盘仍写死在 ScreensaverApp 里 if/else：不可扩展，每加一款都要改渲染层。
- ❌ core 层 import ui 注册表做严格校验：违反「core 纯函数层不依赖 ui」分层，改为 core 宽松透传 + 渲染层兑底。

## 决策 11：表盘预览 = 100vw×100vh 舞台整体缩放（视口缩放策略）

**结论**：新增 `FacePreview.vue`（缩略预览组件）：内层 `.stage` 固定 `100vw×100vh`、与真实全屏逐像素一致地完整渲染表盘，再对整个舞台施加 `transform: translate(-50%,-50%) scale(s)`（`s = min(容器宽/视口宽, 容器高/视口高)`，contain 居中）使其恰好装进任意尺寸容器；`ResizeObserver` + window resize 重算；时间由 `Ticker`（1s、后台暂停）驱动。编辑器表盘下拉（`#option`/`#value` 槽）与 dev 实测台下拉均基于此组件内嵌实时预览。

**理由**：
- 实现前已逐表盘核实：6 款表盘尺寸全部使用 `clamp(...,Nvmin/Nvw,...)` 视口单位，全屏渲染效果只取决于视口——这决定了「舞台整体缩放」方案的正确性（缩略图与全屏逐像素同构，而非近似重写）。
- 零适配扩展：未来任意新表盘（同一视口单位约定）自动获得预览能力，无需逐表盘写缩略样式；避免「每个表盘维护一套尺寸参数」的长期维护债。
- 复用现有 `Ticker`/`getTheme`/`getFace`，预览与屏保共用同一渲染链路与主题。

**备选方案**：
- ❌ 为每个表盘单独写缩略版组件/样式：N 款表盘 × 2 套实现，必然漂移。
- ❌ 用 iframe 隔离渲染：单文件产物下无法用外链页面，且无法复用 Vue 表盘组件。
- ❌ CSS `zoom`/容器查询单位改写：需逐表盘改写单位，仍有漂移风险。

**边界**：预览为纯展示（`pointer-events: none`），不拦截宿主交互；非 Vue 环境（dev 实测页）通过 `src/runtime/preview.ts` 的 `mountFacePreview(host, faceId, opts)` 拿到 `update/destroy` 句柄，展开时惰性挂载、收起即销毁（避免 N 路 ticker 常驻）。

## 决策 12：实测支撑 = window.SnoozePanelTestApi（只读冻结 API）

**结论**：`src/main.ts` 向 `window.SnoozePanelTestApi` 暴露 `Object.freeze({ listFaces: listFaceOptions, mountFacePreview })`（类型以 `satisfies SnoozePanelTestApi` 约束）；供 dev 实测页/自动化验证跨 IIFE 边界消费。

**理由**：
- 产物是单文件 IIFE，dev 页无法 `import` 内部模块；而 dev 页需求（表盘清单 + 实时预览）必须直取运行时真实实现，才能做到「实测的是真实产物而非复制品」。
- 只读（冻结）+ 无副作用 + 无外发请求，符合安全红线；不做路径门控（本地实测页与生产页面同源加载，门控收益极低）。
- 类型与实现同源（`FaceOption` / `FacePreviewOptions` / `FacePreviewHandle` 均从 registry / preview 模块导出），避免双份定义漂移。

**备选方案**：
- ❌ dev 页硬编码表盘清单：与 `faces/registry.ts` 必然漂移（旧 dev 页正是因为硬编码而失真）。
- ❌ 暴露完整内部模块/控制器：超出实测需求，扩大 API 面与误用风险。
- ❌ dev 页引入构建步骤（Vite dev server / 单独 entry）：违背「静态服务器直开、零构建」的实测页定位。

**文档标注**：该 API 明确声明「仅供本地实测页与自动化验证使用，不属于插件业务接口，生产自动化请勿依赖」。

## 决策 13：插件五区布局 + dev 分层装备 + 画布网格为 UI 偏好

**结论**：
- HA 插件配置界面自成**五区**（插件菜单栏 / 组件分类选择区 / 屏保效果阅览与位置尺寸编辑区 / 组件属性编辑器 / 插件状态栏）；该布局由 `EditorApp.vue`（瘦编排层）与 `src/editor/components/` 下五个子组件共同实现（见决策 14）；无论宿主是 HA 卡片编辑弹窗、HA 侧边栏还是 dev 实测台，插件都完整呈现这套布局——菜单栏与状态栏属于插件自身。
- `dev/` 实测台回归**外层测试装备**（截图1 结构）：顶栏（运行时操作，可收起）/ 中部预留舞台（背板 + 与顶底栏 16px 间隔，内嵌同一插件）/ 底栏（运行日志 + mock 后端设备，可向上拖高/收起/恢复默认）。实测台不侵入插件内部；「dev 与 HA 对齐」= 内嵌同一个组件，而非两份功能清单拉平。
- 面板宽度/收起、画布网格（显示/磁吸/步长，`snoozepanel.plugin.layout`）与 dev 顶栏/底栏布局（`snoozepanel.dev.layout`）存 `localStorage`，属**纯 UI 偏好**，与「配置持久化必须走 HA 后端」红线不冲突。
- 中央编辑区默认显示网格并默认开启磁吸附（`src/runtime/drag.ts` 的 `snapTo`/`snapResize` 纯函数，吸附在 clamp 之后执行）；仅鼠标拖拽/缩放吸附，右面板手动输入不被吸附接管。网格层用双轴 1px `linear-gradient` + `background-size: <步长>%` 自适应，仅编辑态渲染。

**理由**：
- 插件被多宿主复用的同一组件：五区布局内聚使「dev 实测台所见即 HA 所见」，避免两套 UI 漂移。
- dev 页本质是测试装备，职责是提供运行时操作与带背板的舞台，不应复制/侵入插件内部结构（早期 dev 页硬编码表盘清单而失真，即此类错误）。
- 面板与网格偏好是「与设备/账号无关的界面状态」，不对应用户配置资产；配置仍走后端，红线不破。

**备选方案**：
- ❌ 插件与 dev 各维护一套布局：必然漂移。
- ❌ 把面板尺寸/网格偏好写进配置对象：把 UI 状态混入用户配置资产，污染后端存储与配置 diff。
- ❌ 网格用 JS 逐帧重算：`linear-gradient` + `background-size(%)` 随尺寸自适应更简、零 JS。

## 决策 14：模块化拆分 = 手写源码单文件 ≤ 520 行 + ESLint max-lines 强制

**结论**：全部手写源码（`src/**/*.{ts,vue}`、`dev/**/*.js`、工程配置 `*.config.ts` / `eslint.config.js`）单文件不得超过 **520 行**，超限必须按职责拆分；约束由 `eslint.config.js` 的一条 `max-lines: ['error', 520]` 规则块**强制**（`pnpm lint` 违规即报错），而非口头约定。重构后全量文件均 ≤ 520 行（最大 `src/ui/components/ComponentWrapper.vue` 440 行）。

**落地方式（重构前仅两个文件超限）**：
- `src/editor/EditorApp.vue`（原约 1350 行）→ **瘦编排层**（约 300 行）+ 五区子组件（`src/editor/components/`：`EditorMenuBar` / `CategoryPanel` / `EditorCanvas` / `PropertyPanel` / `StatusBar`）+ 三个组合式函数（`src/editor/composables/`：`useEditorDraft` 草稿与回声防护、`useComponentSelection` 选中态派生、`useDeviceSave` 设备级保存）。跨区共享的三份可变状态（草稿 / UI 偏好 / 选中态）经 `editorContext.ts` 的 provide/inject 下发，规避 `vue/no-mutating-props` 与逐字段 emit 样板；共享样式抽到 `src/editor/editor.css`，各区专属样式随元素迁入对应子组件。
- `dev/dev.js`（原约 900 行）→ **瘦入口**（约 110 行，仅事件绑定与启动编排）+ 同目录 ES 模块（`types` / `constants` / `state` / `log` / `mock` / `bundle` / `config` / `editor` / `runtime` / `layout.js`）。可变运行时状态收敛到 `state.js` 的单一 `state` 对象——ESM 导入绑定是只读的，跨模块 `let` 重赋值不生效，故必须以对象属性承载。

**理由**：
- 单文件过长使代码审查、符号定位与并行修改成本陡增；按「五区 / 职责」边界拆分后，每个文件聚焦单一关注点。
- 约束必须**可机器强制**（ESLint `max-lines`），否则文件规模回升时无人察觉；`max-lines` 随 `pnpm lint` 天然进入交付卡点。
- 本次为**纯重构**：不改配置字段、不改 UI 外观、不改对外事件与接口，`src/tests/` 无直接引用编辑器内部，单测不受影响。

**备选方案**：
- ❌ 仅口头约定「尽量不超过 N 行」：无强制力，随时间必然回退。
- ❌ 用行数统计脚本做 CI 卡点：与 ESLint 生态割裂，且无法给出违规行级定位。
- ❌ 为凑行数拆分未超限文件：增加无谓的文件跳转成本，违背「仅在超限时按职责拆分」的原则。

## 决策 15：运行时插件 SDK 与预编译插件包（app 式分发）

**结论**：在「单文件 IIFE 主产物 + 构建期 `import.meta.glob` 收集」之外，新增一条**运行时插件通道**。第三方把组件用仓库提供的模板（`plugin-template/` + `vite.plugin.config.ts`）编译为自包含的 `index.js`（**不打包 Vue**，改用宿主暴露的全局 `window.SnoozePanelPluginAPI` 上的 Vue 运行时），以 `<id>/plugin.json` + `<id>/index.js` 构成插件包；用户经市场「安装插件」弹窗导入（**HA 本地 `/local` 目录**或**文件上传**），由 `src/runtime/pluginLoader.ts` 以同源 `<script src>` 或 `blob:` 注入，插件自调用 `registerFace` / `registerWidget` 写入**运行时注册表**（与构建期项合并、同 id 覆盖）。

**理由**：
- 用户明确要求「像 app 一样编译打包好再导入」，即**无需重新构建宿主**即可安装第三方组件；单文件产物无法承载这种动态扩展。
- 复用宿主 Vue 运行时（externalize vue）避免「多份 Vue 实例」导致的响应式 / `inject` 失效，插件体积也大幅减小。
- 仅走**同源 `/local` 与本地 `blob:`**两通道，不引入任意外网 URL，安全红线（不外发请求）不破。
- 注入前设 `sdk.__expect`、注册回调校验 `id` 一致，并校验 `plugin.json` 字段与 `entry` 路径，防止误注册 / 路径穿越。

**备选方案**：
- ❌ 允许任意外网 URL 动态加载：引入外发请求与不可控来源，红线不允。
- ❌ 插件自带 Vue 打包：多实例导致响应式与依赖注入失效，体积也膨胀。
- ❌ 用 ES module / importmap：HA 资源机制不支持 importmap，IIFE 兼容性最好。

**边界**：
- 同源脚本一旦执行无法真正卸载（浏览器不允许移除），卸载仅从运行时注册表移除，彻底清理需刷新页面。
- 插件代码在 HA 页面以完整权限运行，安装前必须展示信任提示（见决策 16 与插件开发文档）。
- 后端仅**存储**插件记录（`.storage/`），绝不执行上传内容；仅前端以 `blob:` 加载。

## 决策 16：元数据驱动属性面板 + 上传限额前后端双重防线

**结论**：
- 属性面板不再是硬编码参数区，而由组件元数据声明的 `PropertyField[]`（`schema`）**动态渲染**；字段有 `type`（color/number/boolean/select/text/textarea）与 `bind`（`'option'` → `options[key]`；`'field'` → 组件顶层字段）。内置表盘/样式全量补齐 schema（时钟顶层字段用 `bind:'field'` 复用单一数据源，第三方统一 `bind:'option'` 透传）。
- 插件上传/安装的限额由**单一常量源**定义（前 `src/core/pluginLimits.ts`、后端 `const.py`、dev mock 三处镜像），前后端**双重校验**：前端为体验层闸门（即时中文反馈），后端为强制层（服务端校验才是安全底线）；后端仅存储不执行。

**理由**：
- 用户要求「规范组件属性编辑权限」：schema 驱动使新增组件无需改属性面板代码，第三方插件可自带参数声明。
- 用户要求「文件上传前后端做好限制，防止无谓攻击损失」：单侧校验不可靠（前端可绕过），必须服务端强制。
- 单一常量源避免前后端口径漂移；限额涵盖类型白名单 / 大小 / 数量 / 内容四维度。

**备选方案**：
- ❌ 只在前端校验：可被绕过，服务端仍会落入超限 / 非法数据。
- ❌ 前后端各自维护限额常量：口径必然漂移（出现「前端放行、后端拒绝」或反之）。
- ❌ 后端执行 / 解析插件内容：扩大攻击面，后端只应存储。

**限额（前端与后端同口径）**：单 `.js` ≤ 512 KB；`plugin.json` ≤ 64 KB；单条记录总量 ≤ 1 MB；已安装总数 ≤ 100；`id` 匹配 `^[a-z0-9][a-z0-9-]{0,63}$`；拒绝空 / 含 NUL 内容；`entry` 禁路径穿越。详见 `doc/开发维护/第三方插件开发/04-安装与信任模型.md`。

## 决策 17：Shadow Root 样式镜像 + 版本查询串缓存破除（v0.11.1 生产事故修复）

**结论**：
- **样式镜像**：被 HA 托管进 shadow 树的元素（`snooze-panel-sidebar` / `snooze-panel-editor`）挂载时自建 shadow root（`core/styleMirror.ts` 的 `createStyledShadowHost`），并用 `MutationObserver`（childList + subtree + characterData）把 `document.head` 中需同步的样式**增量镜像**进该 root：本项目打包 CSS 以 `styles/bundle.css` 的 loud 注释标记 `/*! snoozepanel-bundle-css */` 识别（兜底特征规则 `--snooze-bundle`），PrimeVue 运行时样式以 `data-primevue-style-id` 属性识别（组件首渲染懒创建，observer 跟进）；镜像顺序每次同步按 head 顺序重排，源移除时清理镜像，`destroy()` 停止观察并清空。Vue 应用挂载到 shadow root 内的宿主 div（`app.mount(shadowHost.host)`）。
- **缓存破除**：`panel_custom` 的 `module_url` 追加 `?v=<manifest.version>`（后端 `_frontend_version()` 读 `custom_components/snoozepanel/manifest.json`，单一版本源）；lovelace 资源 URL 同步带同版本串。

**理由（事故复盘）**：
- 生产实测：HA 把 `panel_custom` 元素挂载在 `home-assistant-main` 的 shadow root 内（元素链 home-assistant → shadow → home-assistant-main → shadow → snooze-panel-sidebar），卡片编辑器元素 likewise 落在 HA 弹窗 shadow 树内；而打包 CSS（`vite-plugin-css-injected-by-js` 注入 head）与 PrimeVue 样式（`@primevue/core` useStyle 注入 head）都在 `document.head`，按 CSS Scoping 规范**无法跨 shadow 边界** → 侧边栏配置页/编辑器完全无样式（元素散落、原生控件外观）。dev 实测台挂 light DOM、屏保全屏层挂 `document.body`，故两者均不复现——**dev 通过 ≠ 生产通过**。
- CSS 自定义属性属继承属性、天然跨 shadow 边界，`:root` 变量在 document 侧继续生效，镜像副本无需改写选择器；仅镜像「本项目 + PrimeVue」样式，避免把 HA 自身 head 样式（主题变量等）漏入 shadow 造成污染。
- `/local` 静态产物 `cache-control: max-age=2678400`（31 天）：发版后浏览器不重新验证、长时间命中旧 JS；且**复用已下发过的版本串**（如 `?v=0.11.0` 曾被 lovelace 资源注册过）仍命中旧缓存——必须 bump 到从未下发过的新版本串（v0.11.1），两处 URL（panel module_url + lovelace 资源）同步。

**备选方案**：
- ❌ 把 CSS 内联进每个组件的 `<style>` 并依赖 Vue scoped：PrimeVue 运行时样式仍在 head，跨不过 shadow，问题只解决一半。
- ❌ 用 `::part` / CSS 变量逐处透传：样式面太大（整套编辑器 UI），不可维护。
- ❌ 镜像 head 全部 style：会把 HA 自身主题变量/全局样式漏入 shadow，污染级联且体积翻倍。
- ❌ 缓存破除用构建哈希查询串：需前后端额外传递哈希；manifest 版本已是现成单一源，语义清晰（发版即 bump）。

**边界**：
- 屏保全屏层（`runtime/mount.ts`）挂 `document.body`（light DOM），**不需镜像**；dev 实测台同理。
- 镜像识别依赖标记：新增运行时样式注入通道时，必须在 `styleMirror.ts` 的 `isMirroredStyle` 登记识别依据，否则不会进 shadow。
- 改 `module_url`（含版本 bump）需**重启 HA** 重新注册面板；lovelace 资源 URL 经 WS `lovelace/resources/update`（键 `resource_id`）更新，前端刷新即生效。
- shadow root 会阻断外部 `document.querySelector` 直达元素内部：dev/自动化验证需经 shadow 遍历或 `SnoozePanelTestApi`，不得假设 light DOM 选择器可用。
- **高度链**（v0.11.2 补齐）：`panel_custom` 自定义元素默认 `display:inline` 且无高度，`ha-panel-custom` 只给安全区 padding 不给高度 → 需三层打通：宿主 `display:block` + `calc(100dvh - 安全区)`、shadow 挂载点 `height:100%`、Vue 根全屏 flex，配置页才能铺满剩余空间。

## 决策 18：前端产物自托管 + `add_extra_js_url` 启动早期加载（v0.11.2 侧边栏图标修复）

**结论**：
- 产物由集成目录自托管：`async_setup` 里 `hass.http.async_register_static_paths([StaticPathConfig("/snoozepanel/snoozepanel.js", <集成目录>/frontend/snoozepanel.js, cache_headers=True)])`（HA 2024.7+ API），URL 带 `?v=<manifest.version>` 查询串破除长缓存。
- `frontend.add_extra_js_url(hass, js_url)` 让 HA 在启动页 `<head>` 注入该模块脚本——早于侧边栏首渲，保证自定义图标集（`snoozepanel:logo`）在 `ha-icon` 首次渲染前完成注册。
- `panel_custom` 的 `module_url` 与 extra_js 同 URL（模块按 URL 去重只加载一次）；storage 模式仪表板由 `_async_ensure_lovelace_resource` 自动登记/迁移 Lovelace 资源为同一 URL（YAML 模式跳过）。

**理由（事故复盘）**：
- 生产现象：侧边栏「SnoozePanel」入口图标永久空白。根因：HA 侧边栏用 `<ha-icon .icon=...>` 渲染，`ha-icon` 仅在**首次渲染时**解析 `window.customIcons/customIconsets`；未命中则置 `_legacy=true` 渲染已废弃的 `<iron-icon>`（空白）且**永不重试**（`_legacy` 只在 mdi 分支复位——sticky 表现已对照 HA 前端源码核实）。
- 旧机制下产物作为 Lovelace 资源在 lovelace 面板初始化时才加载、作为 `panel_custom` 的 `module_url` 仅在进入面板时加载，均晚于侧边栏首渲 → 图标注册永远迟到。
- `add_extra_js_url` 是 HA 官方给集成的启动页脚本注入通道（另有 `subscribe_extra_js` 热更兜底），时序确定性最强。
- 产物迁出 `/local` 的附带收益：摆脱 `/local` 31 天 `cache-control`（决策 17 的缓存痛点改由 `?v=` 查询串 + `cache_headers=True` 可控缓存解决）；HACS zip 分发（`zip_release`）要求 zip 根即集成文件，产物随集成一体分发顺理成章。

**备选方案**：
- ❌ 保持晚加载、注册图标集后 DOM nudge（改 `ha-icon` 属性逼重渲染）：依赖 HA 内部实现细节，`_legacy` 分支不重读 customIcons，nudge 不可靠。
- ❌ `sidebar_icon` 回退 mdi 图标：放弃品牌图标，且未根治「产物加载晚」的时序问题。
- ❌ 继续要求用户手动在 `www/` 放产物 + 手动加资源：31 天缓存与手动迁移成本照旧，HACS 分发也不适用。

**边界**：
- `hacs.json` 将最低 HA 版本锁定 2024.7（`async_register_static_paths` 引入版本），安装文档同步。
- 第三方运行时插件通道（`/local/snoozepanel/plugins`）**不随迁出**：那是用户资产通道，保持决策 15 不变。

## 决策 19：PrimeVue 浮层锚点同步捕获 + 双 nextTick 对齐 + `@click.stop`（v0.11.2 菜单闪退修复）

**结论**：`EditorMenuBar.toggleMenuPanel` 在事件派发期间**同步**把 `ev.currentTarget` 存为 `anchor`，再于 `nextTick` 里 `popover.show(ev, anchor)`；`show` 之后再嵌套一层 `nextTick` 才显式 `alignOverlay()`；菜单按钮统一 `@click.stop`。

**理由（事故复盘）**：
- 生产现象：配置页菜单浮层「一闪而过、无法点击」。根因有两层——
  1. DOM 规范规定事件派发结束后 `currentTarget` 置 `null`；原先在 `nextTick` 里 `show(ev)`，Popover 的 `target/eventTarget` 均为 null → `onEnter → alignOverlay → absolutePosition(container, null)` 读 `null.offsetHeight` 抛 TypeError（后续监听未绑定）→ 浮层停在 `top:0` 错位显示；而组件初始化时已挂的 document 级 outside-click 监听（`isTargetClicked` 因 `eventTarget=null` 恒 false）在下一次点击立刻关闭它。
  2. 修复 1 后首次点击仍报 unhandled rejection（`absolutePosition(undefined, ...)` 读 `undefined.style`）：`show()` 置 visible 后 container 需下一轮渲染才挂载，同一 nextTick 内调 `alignOverlay()` 必然踩空；第二层 nextTick 后 container 就绪。切换菜单时 container 已存在、但两面板同尺寸时内容 ResizeObserver 不触发，必须显式按新锚点重对齐——双 nextTick 同时覆盖两种情形。
- `@click.stop`：阻止菜单按钮点击冒泡到 document 级 outside-click 监听，同时消除 shadow DOM 事件重定向导致的「切换菜单先关后开」闪烁（浮层内容 teleport 到 body 属 light DOM，内部点击不受影响）。
- 此 bug 与宿主无关（dev 页同样复现），属组件内部时序问题；修复经实测台真实点击验证（五个菜单逐一展开/切换/点选/外部关闭）。

**备选方案**：
- ❌ 改用 PrimeVue `TieredMenu`/`Menu` 重写菜单栏：改动面大，且根因（锚点捕获时机）在任何浮层组件都存在。
- ❌ `show(ev)` 后用 `setTimeout` 代替嵌套 nextTick：宏任务时序不保证与 Vue 渲染同步，属于碰运气。
- ❌ 不加 `@click.stop`、靠 outside-click 的 `isTargetClicked` 排除按钮：shadow 重定向下事件 target 是宿主元素，排除逻辑不可靠。

**边界**：浮层锚点必须同步捕获是一条通用规则——任何「click 事件 → 异步 show」的用法都要先存 `currentTarget`。
