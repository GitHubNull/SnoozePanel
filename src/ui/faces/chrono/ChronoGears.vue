<script setup lang="ts">
/**
 * 镂空齿轮组：机械计时码表中央镂空窗内可见的传动齿轮。
 *
 * 动画：纯 CSS 关键帧（浏览器合成层匀速 60fps），不再由 1s tick 逐帧重算，
 *       因此转动连续平滑、且不随 tick 抖动。
 * 传动比按齿数推导（啮合齿轮反向、角速度比 = 齿数反比）：
 *   大齿轮 18T 正转 60s/圈 → 中齿轮 12T 反向 40s/圈 → 小齿轮 10T 正转 33.33s/圈。
 * 三者共用同一相位偏移（animation-delay），保证齿牙始终啮合且与秒针相位一致。
 * 配色：玫瑰金 + 黄铜，还原机械表金属质感。
 */
import { useId } from 'vue';

const props = defineProps<{
  now: Date;
  /** 主齿轮色（玫瑰金） */
  roseGold: string;
  /** 次齿轮色（黄铜） */
  brass: string;
}>();

const uid = useId();
const goldId = `gear-gold-${uid}`;
const darkId = `gear-dark-${uid}`;

/** 相位偏移：使齿轮起始角度与当前秒数对齐；仅 setup 计算一次，避免每秒跳动 */
const phaseDelay = `-${props.now.getSeconds() + props.now.getMilliseconds() / 1000}s`;

/** 生成齿轮轮廓 path：外圈均布梯形齿牙（齿根圆与齿顶圆之间径向进出） */
function gearPath(rOuter: number, rRoot: number, teeth: number): string {
  const step = (Math.PI * 2) / teeth;
  const halfTooth = step * 0.26; // 齿牙半宽占比
  const p = (ang: number, r: number) => `${(r * Math.cos(ang)).toFixed(2)},${(r * Math.sin(ang)).toFixed(2)}`;
  let d = '';
  for (let i = 0; i < teeth; i++) {
    const a = i * step;
    const a0 = a - halfTooth;
    const a1 = a + halfTooth;
    d += `${i === 0 ? 'M' : 'L'}${p(a0, rRoot)} L${p(a0, rOuter)} L${p(a1, rOuter)} L${p(a1, rRoot)} `;
  }
  return `${d}Z`;
}

// 三齿轮几何：齿根/齿顶半径按同一模数推导，中心距 = 两啮合齿轮节圆半径之和
const bigGear = gearPath(13.3, 10.7, 18);
const midGear = gearPath(9.3, 6.7, 12);
const smallGear = gearPath(8.0, 5.3, 10);

/** 每个齿轮的动画样式（时长 + 相位偏移） */
function spin(duration: string): Record<string, string> {
  return { animationDuration: duration, animationDelay: phaseDelay };
}
</script>

<template>
  <g class="gears">
    <defs>
      <!-- 玫瑰金径向金属渐变 -->
      <radialGradient :id="goldId" cx="0.34" cy="0.28" r="0.9">
        <stop offset="0%" stop-color="#f4dcc0" />
        <stop offset="48%" :stop-color="roseGold" />
        <stop offset="100%" stop-color="#7d4a33" />
      </radialGradient>
      <!-- 齿轮阴影深色 -->
      <radialGradient :id="darkId" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0%" stop-color="#2a1c14" />
        <stop offset="100%" stop-color="#120c08" />
      </radialGradient>
    </defs>

    <!-- 大齿轮（左下，玫瑰金，正转 60s） -->
    <g transform="translate(91 110)">
      <g class="gear-spin" :style="spin('60s')">
        <path :d="bigGear" :fill="`url(#${goldId})`" />
        <path :d="bigGear" fill="none" :stroke="roseGold" stroke-width="0.5" opacity="0.6" />
        <circle r="4" :fill="`url(#${darkId})`" />
        <circle r="2.4" :fill="brass" />
        <circle r="1" fill="#f4dcc0" opacity="0.8" />
      </g>
    </g>

    <!-- 中齿轮（右上，黄铜，反转 40s） -->
    <g transform="translate(105.1 95.9)">
      <g class="gear-spin gear-rev" :style="spin('40s')">
        <path :d="midGear" :fill="brass" />
        <path :d="midGear" fill="none" :stroke="roseGold" stroke-width="0.4" opacity="0.5" />
        <circle r="2.8" :fill="`url(#${darkId})`" />
        <circle r="1.6" :fill="roseGold" />
      </g>
    </g>

    <!-- 小齿轮（上，玫瑰金，正转 33.33s） -->
    <g transform="translate(94.7 85.5)">
      <g class="gear-spin" :style="spin('33.33s')">
        <path :d="smallGear" :fill="`url(#${goldId})`" />
        <circle r="2.2" :fill="`url(#${darkId})`" />
        <circle r="1.1" :fill="brass" />
      </g>
    </g>
  </g>
</template>

<style scoped>
/* 齿轮自转：以自身几何包围盒中心为原点（齿盘以局部原点为中心绘制） */
.gear-spin {
  transform-box: fill-box;
  transform-origin: center;
  animation-name: gearSpin;
  animation-timing-function: linear;
  animation-iteration-count: infinite;
  will-change: transform;
}
.gear-rev {
  animation-direction: reverse;
}
@keyframes gearSpin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
/* 无障碍：偏好减少动效时停转（静态展示） */
@media (prefers-reduced-motion: reduce) {
  .gear-spin { animation: none; }
}
</style>
