/**
 * 样式镜像：解决本组件被 HA 托管进 Shadow Root 后样式丢失的问题。
 *
 * 背景（生产实测事故）：HA 把 panel_custom 元素（snooze-panel-sidebar）挂载在
 * home-assistant-main 的 shadow root 内，卡片编辑器元素 likewise 落在 HA 弹窗的
 * shadow 树内；而本项目打包 CSS（vite-plugin-css-injected-by-js 注入
 * document.head）与 PrimeVue 运行时样式（<style data-primevue-style-id>，
 * 见 @primevue/core useStyle）都在 document.head，按 CSS Scoping 规范无法跨
 * shadow 边界生效 → 生产环境面板/编辑器完全无样式（元素散落）。
 * dev 实测台直接挂载在 document light DOM，故开发环境不复现。
 *
 * 对策：元素挂载时创建自有 shadow root，并把 document.head 中需同步的样式
 * 「镜像」进该 root：
 *  - 本项目打包 CSS：以 loud 注释标记 / 特征规则识别（见 styles/bundle.css）；
 *  - PrimeVue 组件样式：以 data-primevue-style-id 属性识别，组件首渲染时懒创建，
 *    用 MutationObserver 增量跟进（含创建后回填 innerHTML 的字符变更）。
 * CSS 自定义属性属继承属性、天然跨 shadow 边界，:root 上的变量定义在 document
 * 侧继续生效，镜像副本无需改写选择器。
 * 屏保全屏层挂载于 document.body（light DOM），不受本机制影响、无需镜像。
 */

/** 打包 CSS 的 loud 注释标记（与 styles/bundle.css 首行一致，压缩后保留） */
const BUNDLE_MARKER = 'snoozepanel-bundle-css';
/** 特征规则兜底（防标记注释被个别压缩器裁剪） */
const BUNDLE_FALLBACK = '--snooze-bundle';
/** PrimeVue 运行时样式标签属性（@primevue/core useStyle 写入） */
const PRIMEVUE_STYLE_ATTR = 'data-primevue-style-id';

/** 判断 head 中的 style 是否属于需镜像进 shadow root 的样式 */
function isMirroredStyle(el: Element): boolean {
  if (el.tagName !== 'STYLE') return false;
  const style = el as HTMLStyleElement;
  if (style.hasAttribute(PRIMEVUE_STYLE_ATTR)) return true;
  const text = style.textContent ?? '';
  return text.includes(BUNDLE_MARKER) || text.includes(BUNDLE_FALLBACK);
}

export interface StyleMirrorHandle {
  /** 停止镜像并移除已注入 shadow root 的全部镜像样式节点 */
  destroy(): void;
}

/**
 * 把 document.head 中需同步的样式镜像进指定 shadow root。
 * 镜像顺序每次同步时按 head 顺序重排（appendChild 移动已存在节点），
 * 保证 shadow 内级联顺序与 document 一致。
 */
export function mirrorDocumentStylesInto(root: ShadowRoot): StyleMirrorHandle {
  const mirrors = new Map<HTMLStyleElement, HTMLStyleElement>();
  let scheduled = false;

  const sync = (): void => {
    scheduled = false;
    const sources = Array.from(document.head.querySelectorAll('style')).filter(isMirroredStyle);
    const seen = new Set<HTMLStyleElement>();
    for (const src of sources) {
      seen.add(src);
      let mirror = mirrors.get(src);
      if (!mirror) {
        mirror = document.createElement('style');
        mirror.setAttribute('data-snooze-mirror', '');
        mirrors.set(src, mirror);
      }
      const text = src.textContent ?? '';
      if (mirror.textContent !== text) mirror.textContent = text;
      // 按 head 顺序重排（已存在节点 appendChild 即移动）
      root.appendChild(mirror);
    }
    // 源已移除的（PrimeVue 组件卸载会销毁其 style 元素）清理镜像节点
    for (const [src, mirror] of Array.from(mirrors.entries())) {
      if (!seen.has(src)) {
        mirror.remove();
        mirrors.delete(src);
      }
    }
  };

  const schedule = (): void => {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(sync);
  };

  // PrimeVue 组件样式懒创建且创建后回填内容：childList + characterData + subtree 全覆盖
  const observer = new MutationObserver(schedule);
  observer.observe(document.head, { childList: true, subtree: true, characterData: true });
  sync();

  return {
    destroy(): void {
      observer.disconnect();
      for (const mirror of mirrors.values()) mirror.remove();
      mirrors.clear();
    },
  };
}

export interface StyledShadowHost {
  /** 元素自有 shadow root（镜像样式注入处） */
  root: ShadowRoot;
  /** shadow root 内的 Vue 应用挂载点 */
  host: HTMLElement;
  /** 卸载：停止样式镜像（shadow 树随元素移除一并丢弃） */
  destroy(): void;
}

/**
 * 为元素创建带样式镜像的自有 shadow root，返回 Vue 应用挂载点。
 * 供 sidebar / editor 等「被 HA 托管进 shadow 树」的元素统一使用。
 */
export function createStyledShadowHost(el: HTMLElement): StyledShadowHost {
  const root = el.shadowRoot ?? el.attachShadow({ mode: 'open' });
  const handle = mirrorDocumentStylesInto(root);
  const host = document.createElement('div');
  root.appendChild(host);
  return { root, host, destroy: handle.destroy };
}
