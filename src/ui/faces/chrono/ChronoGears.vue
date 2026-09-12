<script setup lang="ts">
/**
 * 镂空齿轮组：机械计时码表中央镂空窗内可见的传动齿轮。
 * 大齿轮随秒针每分钟转一圈，其余齿轮反向联动，强化"机械感"。
 * 所有齿轮均嵌套于中央镂空窗（r≈27）内，避免与子表盘重叠。
 * 配色：玫瑰金 + 黄铜，还原机械表的金属质感。
 */
import { computed } from 'vue';

const props = defineProps<{
  now: Date;
  /** 主齿轮色（玫瑰金） */
  roseGold: string;
  /** 次齿轮色（黄铜） */
  brass: string;
}>();

// 大齿轮随秒针转动（每分钟一圈），中/小齿轮反向联动
const bigGearAngle = computed(() => (props.now.getSeconds() + props.now.getMilliseconds() / 1000) * 6);
const midGearAngle = computed(() => -bigGearAngle.value * 1.7);
const smallGearAngle = computed(() => bigGearAngle.value * 1.35);

/** 生成齿轮轮廓 path：外圈均布齿牙 */
function gearPath(cx: number, cy: number, rOuter: number, rInner: number, teeth: number): string {
  const step = (Math.PI * 2) / teeth;
  const toothW = step * 0.45; // 齿牙占比
  let d = '';
  for (let i = 0; i < teeth; i++) {
    const a = i * step;
    const a0 = a - toothW / 2;
    const a1 = a + toothW / 2;
    const a2 = a + step / 2 - toothW / 2;
    const a3 = a + step / 2 + toothW / 2;
    const p = (ang: number, r: number) => `${(cx + r * Math.cos(ang)).toFixed(2)},${(cy + r * Math.sin(ang)).toFixed(2)}`;
    d += `${i === 0 ? 'M' : 'L'}${p(a0, rInner)} L${p(a0, rOuter)} L${p(a1, rOuter)} L${p(a1, rInner)} L${p(a2, rInner)} L${p(a2, rOuter)} L${p(a3, rOuter)} L${p(a3, rInner)} `;
  }
  return d + 'Z';
}

const bigGear = gearPath(0, 0, 14, 11, 18);
const midGear = gearPath(0, 0, 9.5, 7.2, 12);
const smallGear = gearPath(0, 0, 6.5, 4.8, 10);
</script>

<template>
  <g class="gears">
    <!-- 大齿轮（左下，玫瑰金） -->
    <g :transform="`translate(93 108) rotate(${bigGearAngle})`">
      <path :d="bigGear" :fill="roseGold" opacity="0.9" />
      <circle r="3.4" fill="#1a120c" />
      <circle r="1.6" :fill="brass" />
    </g>
    <!-- 中齿轮（右上，黄铜） -->
    <g :transform="`translate(109 92) rotate(${midGearAngle})`">
      <path :d="midGear" :fill="brass" opacity="0.92" />
      <circle r="2.4" fill="#1a120c" />
      <circle r="1.1" :fill="roseGold" />
    </g>
    <!-- 小齿轮（上，玫瑰金） -->
    <g :transform="`translate(99 84) rotate(${smallGearAngle})`">
      <path :d="smallGear" :fill="roseGold" opacity="0.85" />
      <circle r="1.6" fill="#1a120c" />
    </g>
  </g>
</template>
