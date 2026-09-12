/**
 * SnoozePanel 表盘插件示例（像素时钟）。
 *
 * 本文件演示第三方「预编译插件包」的最小实现，可整目录拷贝为新插件：
 *   - 仅依赖宿主 SDK 暴露的全局 `SnoozePanelPluginAPI`（含 Vue 运行时与注册接口）；
 *   - 构建时 `vue` 被 externalize 到 `SnoozePanelPluginAPI.vue`，产物不打包 Vue；
 *   - 组件接收与宿主一致的 FaceProps（now / seconds / hour24 / theme / options）；
 *   - 通过 schema 声明可配置项，宿主属性面板据此渲染控件并写入 `options`。
 *
 * 构建：`pnpm build:plugin plugin-template dist`（产物含 index.js + plugin.json）。
 */

import { computed, defineComponent, h, type PropType } from 'vue';

/**
 * 宿主注入的全局插件 SDK。
 * 声明仅覆盖本示例用到的最小面；完整定义见宿主 src/ui/plugins/sdk.ts。
 */
declare const SnoozePanelPluginAPI: {
  apiVersion: number;
  registerFace(meta: Record<string, unknown>): void;
  registerWidget(meta: Record<string, unknown>): void;
};

/** 主题子集（与宿主 Theme 对齐，仅取本组件需要的字段） */
interface FaceTheme {
  key?: string;
  fontFamily?: string;
  clockWeight?: number | string;
  text?: string;
  textSecondary?: string;
}

const PixelFace = defineComponent({
  name: 'PixelFace',
  props: {
    now: { type: Object as PropType<Date>, required: true },
    seconds: { type: Boolean, default: false },
    hour24: { type: Boolean, default: true },
    theme: { type: Object as PropType<FaceTheme>, default: () => ({}) },
    options: { type: Object as PropType<Record<string, unknown>>, default: () => ({}) },
  },
  setup(props) {
    const pad = (n: number): string => String(n).padStart(2, '0');

    const display = computed(() => {
      let hh = props.now.getHours();
      let period = '';
      if (!props.hour24) {
        period = hh >= 12 ? 'PM' : 'AM';
        hh = hh % 12 || 12;
      }
      const base = `${pad(hh)}:${pad(props.now.getMinutes())}`;
      return {
        main: props.seconds ? `${base}:${pad(props.now.getSeconds())}` : base,
        period,
      };
    });

    const accent = computed(() =>
      typeof props.options.accent === 'string' ? props.options.accent : '#7fd3ff',
    );
    const glow = computed(() =>
      props.options.glow === false ? 'none' : `0 0 24px ${accent.value}`,
    );

    return () =>
      h(
        'div',
        {
          class: 'pixel-face',
          style: {
            fontFamily: props.theme.fontFamily ?? 'ui-monospace, monospace',
            fontWeight: String(props.theme.clockWeight ?? 700),
            color: accent.value,
            textShadow: glow.value,
            fontSize: 'clamp(56px, 15cqw, 200px)',
            lineHeight: '1',
            letterSpacing: '0.04em',
            fontVariantNumeric: 'tabular-nums',
          },
        },
        [
          display.value.main,
          display.value.period
            ? h(
                'span',
                { style: { fontSize: '0.32em', marginLeft: '0.4em', opacity: '0.75' } },
                display.value.period,
              )
            : null,
        ],
      );
  },
});

// 注册到宿主运行时注册表（注册成功与否由加载器校验）
SnoozePanelPluginAPI.registerFace({
  id: 'pixel',
  label: '像素时钟',
  kind: 'digital',
  author: 'SnoozePanel 社区',
  version: '1.0.0',
  summary: '复古霓虹风格的数字时钟，支持自定义强调色与发光。',
  description:
    '演示第三方表盘插件的最小实现：仅依赖宿主 SDK 暴露的 Vue 运行时与统一 FaceProps，' +
    '通过 options 透传自定义参数，并按元数据 schema 声明属性面板控件。',
  usage: '安装后于「表盘市场」中选择「像素时钟」，可在属性面板调整强调色与发光开关。',
  homepage: 'https://github.com/snoozepanel/snoozepanel',
  license: 'MIT',
  schema: [
    { key: 'accent', label: '强调色', type: 'color', default: '#7fd3ff' },
    { key: 'glow', label: '霓虹发光', type: 'boolean', default: true },
  ],
  component: PixelFace,
});
