// @ts-check
/**
 * SnoozePanel 本地实测台入口（静态服务器直开，无构建步骤）。
 *
 * 设计约束：
 *   - 仅消费构建产物暴露的 window.SnoozePanelTestApi（只读、无副作用），
 *     跨 IIFE 边界获取表盘清单，并在主内容区「内嵌真实配置编辑器」（mountEditor）；
 *   - 触发 / 退出走生产同款 screensaver_entity 通路
 *     （mock input_boolean 置位 + 重新赋值 el.hass → controller.syncFromEntity）；
 *   - 配置以编辑器为单一来源：挂载时读取编辑器当前配置；编辑器的变更（config-changed）
 *     实时回填给运行中的面板元素（与 HA 收到 config-changed 后回填 setConfig 一致）；
 *   - 页面布局：顶栏（运行时操作，可收起）/ 舞台（背板内嵌编辑器：菜单栏·分类区·预览画布·属性区·状态栏）/ 底栏（日志·设备，可拖高/收起）；
 *   - 页面 UI 偏好（顶栏收起、底栏高度/收起）存 localStorage（仅 UI 偏好，不涉及插件配置）；
 *   - 所有操作走 Toast + 分级日志，全局异常（error / unhandledrejection）也纳入日志，
 *     保证「控制台零报错」可自证；
 *   - 本文件由 tsconfig.dev.json（allowJs + checkJs）做类型检查。
 *
 * 模块划分（同目录，均为 ES 模块）：
 *   - types.js      共享 JSDoc 类型定义
 *   - constants.js  常量
 *   - state.js      页面元素引用 + 可变运行时状态（单一对象承载）
 *   - log.js        分级日志 / Toast / 按钮 busy 态
 *   - mock.js       mock hass + mock 后端 + 设备列表
 *   - bundle.js     构建产物加载与徽标
 *   - config.js     运行时配置构建与读取
 *   - editor.js     内嵌编辑器创建与配置变更桥接
 *   - runtime.js    运行时挂载/触发/退出/卸载 + 状态徽标
 *   - layout.js     实测台 UI 布局偏好
 *   本入口仅负责事件绑定与启动编排。
 */
import { el, state } from './state.js';
import { log, setBusy } from './log.js';
import { refreshDeviceList } from './mock.js';
import { loadBundle } from './bundle.js';
import { ensureEditor } from './editor.js';
import {
  handleMountClick,
  handleReapplyClick,
  handleTriggerClick,
  handleExitClick,
  handleUnmountClick,
  updateRuntimeStatus,
  updateActionButtons,
} from './runtime.js';
import {
  loadDevLayout,
  applyDevLayout,
  setTopCollapsed,
  setBottomCollapsed,
  restoreBottomHeight,
  startBottomResize,
  onWindowResize,
} from './layout.js';

/** 注册所有事件监听（含全局异常入日志）。 */
function bindEvents() {
  el.btnMount.addEventListener('click', handleMountClick);
  el.btnReapply.addEventListener('click', handleReapplyClick);
  el.btnTrigger.addEventListener('click', handleTriggerClick);
  el.btnExit.addEventListener('click', handleExitClick);
  el.btnUnmount.addEventListener('click', handleUnmountClick);
  el.btnReloadBundle.addEventListener('click', () => {
    setBusy(el.btnReloadBundle, true);
    void loadBundle().finally(() => setBusy(el.btnReloadBundle, false));
  });
  el.btnRefreshDevices.addEventListener('click', () => { void refreshDeviceList(); });
  el.btnClearLog.addEventListener('click', () => {
    el.logList.innerHTML = '';
    log('info', '日志已清空');
  });

  // 实测台布局交互：顶栏收起/展开、底栏拖高/收起/恢复默认
  el.btnTopCollapse.addEventListener('click', () => setTopCollapsed(true));
  el.btnTopExpand.addEventListener('click', () => setTopCollapsed(false));
  el.btnBottomCollapse.addEventListener('click', () => setBottomCollapsed(true));
  el.btnBottomExpand.addEventListener('click', () => setBottomCollapsed(false));
  el.btnRestoreBottom.addEventListener('click', restoreBottomHeight);
  el.bottombarResizer.addEventListener('pointerdown', startBottomResize);
  window.addEventListener('resize', onWindowResize);

  // 全局异常入日志：确保「控制台无报错」可自证
  window.addEventListener('error', (ev) => {
    log('error', 'window error：' + (ev.message || '未知错误') + (ev.filename ? ' @ ' + ev.filename + ':' + ev.lineno : ''));
  });
  window.addEventListener('unhandledrejection', (ev) => {
    log('error', 'unhandled rejection：' + String(ev.reason));
  });

  // 用户输入刷新待机倒计时基准（与控制器内部闲置计时近似对齐）
  const markInput = () => { state.lastInputAt = Date.now(); };
  window.addEventListener('pointerdown', markInput, { passive: true, capture: true });
  window.addEventListener('keydown', markInput, true);
}

/** 启动：应用 UI 布局 → 初始禁用 → 加载产物 → 内嵌编辑器 → 初始化设备列表 → 状态轮询。 */
async function bootstrap() {
  // 最先应用布局偏好，避免刷新闪跳
  loadDevLayout();
  applyDevLayout();
  // PrimeVue 深色主题（编辑器内部组件跟随；与实测台整体风格一致）
  document.documentElement.classList.add('snooze-editor-dark');
  updateActionButtons();
  log('info', '本地实测台启动：mock hass + mock 后端已就绪');
  await loadBundle();
  ensureEditor();
  await refreshDeviceList();
  window.setInterval(updateRuntimeStatus, 250);
  updateRuntimeStatus();
}

bindEvents();
void bootstrap();
