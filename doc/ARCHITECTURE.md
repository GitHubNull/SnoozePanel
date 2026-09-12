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
- HA 前端无 Vue，必须自包含打包（产物约 528KB，gzip 约 129KB，可接受）。
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
- ❌ 表盘运行时从 URL 动态加载：违反「不外发请求」红线，且单文件产物不允许。
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
