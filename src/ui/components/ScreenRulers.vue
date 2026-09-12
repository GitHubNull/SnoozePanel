<script setup lang="ts">
/**
 * 模拟屏幕外挂标尺（纵 / 横两把）：以屏幕左下角为原点，分别向上、向右伸展。
 *
 * 作为 DevicePreview 机身外框（.device-frame）内的绝对定位叠加层渲染，
 * 随预览一起缩放（刻度数字随缩放变化，符合既定取舍）。
 * 刻度由纯函数 computeRulerTicks 计算（默认分辨率 px，可切换 cm / mm）。
 * 纯装饰、不拦截手势（pointer-events:none + aria-hidden）。
 */
import { computed } from 'vue';
import { computeRulerTicks, RULER_UNIT_LABEL, type RulerUnit } from '@/core/ruler';

const props = defineProps<{
  /** 屏幕宽（设备 CSS px） */
  width: number;
  /** 屏幕高（设备 CSS px） */
  height: number;
  /** 机身边框厚度（设备 CSS px），用于把标尺对齐到屏幕边缘 */
  bezelPad: number;
  /** 标尺槽厚度（设备 CSS px） */
  thickness: number;
  /** 标尺单位 */
  unit: RulerUnit;
}>();

/** 纵标尺刻度（沿屏幕高，自底向上） */
const verticalTicks = computed(() => computeRulerTicks(props.height, props.unit));
/** 横标尺刻度（沿屏幕宽，自左向右） */
const horizontalTicks = computed(() => computeRulerTicks(props.width, props.unit));

/** 机身外框高度 = 屏幕高 + 上下边框（横标尺与角块即贴此下缘） */
const bodyH = computed(() => props.height + props.bezelPad * 2);
/** 单位文案 */
const unitLabel = computed(() => RULER_UNIT_LABEL[props.unit]);
</script>

<template>
  <div class="ruler-layer" aria-hidden="true">
    <!-- 纵标尺：贴屏幕左缘外侧，0 点在屏幕左下角，向上递增 -->
    <div
      class="ruler ruler-v"
      :style="{ top: bezelPad + 'px', width: thickness + 'px', height: height + 'px' }"
    >
      <template v-for="(t, i) in verticalTicks" :key="'v' + i">
        <span class="tick tick-v" :class="t.major ? 'major' : 'minor'" :style="{ bottom: t.pos + 'px' }"></span>
        <span v-if="t.major" class="tick-label tick-label-v" :style="{ bottom: t.pos + 'px' }">{{ t.label }}</span>
      </template>
    </div>

    <!-- 横标尺：贴屏幕下缘外侧，0 点在屏幕左下角，向右递增 -->
    <div
      class="ruler ruler-h"
      :style="{ left: thickness + bezelPad + 'px', top: bodyH + 'px', width: width + 'px', height: thickness + 'px' }"
    >
      <template v-for="(t, i) in horizontalTicks" :key="'h' + i">
        <span class="tick tick-h" :class="t.major ? 'major' : 'minor'" :style="{ left: t.pos + 'px' }"></span>
        <span v-if="t.major" class="tick-label tick-label-h" :style="{ left: t.pos + 'px' }">{{ t.label }}</span>
      </template>
    </div>

    <!-- 原点角块：显示当前单位 -->
    <div class="ruler-corner" :style="{ top: bodyH + 'px', width: thickness + 'px', height: thickness + 'px' }">
      {{ unitLabel }}
    </div>
  </div>
</template>

<style scoped>
/* 叠加层铺满机身外框，纯装饰不拦截手势 */
.ruler-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
  color: #c7ced6;
  font-size: 9px;
  line-height: 1;
}

/* 标尺槽：暗色底 + 靠屏幕一侧的内描边 */
.ruler {
  position: absolute;
  background: rgba(18, 22, 30, 0.82);
}
.ruler-v {
  border-right: 1px solid rgba(255, 255, 255, 0.14);
}
.ruler-h {
  border-top: 1px solid rgba(255, 255, 255, 0.14);
}

/* 刻度线 */
.tick {
  position: absolute;
  background: currentColor;
}
.tick.major {
  opacity: 0.9;
}
.tick.minor {
  opacity: 0.45;
}
/* 纵标尺刻度：贴右缘（靠屏幕侧），次刻度仅占部分宽度 */
.tick-v {
  right: 0;
  height: 1px;
}
.tick-v.major {
  width: 100%;
}
.tick-v.minor {
  width: 40%;
}
/* 横标尺刻度：贴上缘（靠屏幕侧） */
.tick-h {
  top: 0;
  width: 1px;
}
.tick-h.major {
  height: 100%;
}
.tick-h.minor {
  height: 40%;
}

/* 刻度数字 */
.tick-label {
  position: absolute;
  font-size: 9px;
  color: currentColor;
  white-space: nowrap;
}
/* 纵标尺标签：竖排（自下而上），置于刻度左侧 */
.tick-label-v {
  left: 2px;
  writing-mode: vertical-rl;
  transform: rotate(180deg);
  transform-origin: left center;
}
/* 横标尺标签：置于刻度右侧，避免压住刻度线 */
.tick-label-h {
  top: 3px;
  transform: translateX(2px);
}

/* 原点角块 */
.ruler-corner {
  position: absolute;
  left: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(18, 22, 30, 0.95);
  border-top: 1px solid rgba(255, 255, 255, 0.14);
  border-right: 1px solid rgba(255, 255, 255, 0.14);
  font-size: 9px;
  color: #9aa3ad;
}
</style>
