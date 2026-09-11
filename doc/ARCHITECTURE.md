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

## 决策 8：目录纪律 = 工程文件全放 tmp/

**结论**：`package.json` / `vite.config.ts` / `tsconfig.json` / `vitest.config.ts` / `node_modules` / `dist` / `dev` 全部放 `tmp/`；`src/` 仅 `.ts`/`.vue` 源码；仓库根 `node_modules` 是指向 `tmp/node_modules` 的 Junction。

**理由**：
- 用户硬性约束：`tmp/` 是唯一临时目录，`src/` 只放入库源码。
- 工程文件放 `tmp/`：保持仓库根干净，git 追踪的只有源码/文档/截图。
- Junction 解决依赖解析：src 在 vite root（tmp/）之外，Vite 向上找 node_modules 会找到仓库根；Junction 让仓库根的 node_modules 透明转发到 tmp/node_modules，构建正常。

**备选方案**：
- ❌ 工程文件放项目根：违反用户目录约束。
- ❌ 把 src 移进 tmp/：违反「src/ 仅入库源码」约束，且 git 追踪路径混乱。
