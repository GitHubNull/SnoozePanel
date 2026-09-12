<script setup lang="ts">
/**
 * 日历·彩框月历（第三方样例样式）。
 *
 * 用于验证第三方组件加载：在整月网格外套一层强调色描边容器，今日以实心圆高亮。
 * 从 options 读取：week_start、show_week_number、format。
 */
import { computed } from 'vue';
import { buildCalendarGrid, weekdayHeaders, isoWeekNumber, formatDate } from '@/core/clock';
import type { WidgetProps } from '@/ui/widgets/types';

const props = defineProps<WidgetProps>();

const weekStart = computed<0 | 1>(() => (props.options.week_start === 0 ? 0 : 1));
const showWeekNumber = computed(() => props.options.show_week_number === true);
const format = computed<string>(() =>
  typeof props.options.format === 'string' && props.options.format ? props.options.format : 'M月D日 dddd',
);

const grid = computed(() =>
  buildCalendarGrid(props.now.getFullYear(), props.now.getMonth(), weekStart.value),
);
const headers = computed(() => weekdayHeaders(weekStart.value));
const title = computed(() => formatDate(props.now, format.value));
</script>

<template>
  <div class="cal-fancy">
    <div class="fancy-title">{{ title }}</div>
    <table>
      <thead>
        <tr>
          <th v-if="showWeekNumber" class="weeknum">周</th>
          <th v-for="h in headers" :key="h">{{ h }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, ri) in grid" :key="ri">
          <td v-if="showWeekNumber" class="weeknum">{{ isoWeekNumber(row[0].date) }}</td>
          <td
            v-for="cell in row"
            :key="cell.date.toDateString()"
            :class="{ dim: !cell.inCurrentMonth, today: cell.isToday }"
          >
            {{ cell.date.getDate() }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.cal-fancy {
  padding: 0.7em 0.9em;
  border: 2px solid var(--snooze-accent, #5ea0ff);
  border-radius: 12px;
  background: color-mix(in srgb, var(--snooze-accent, #5ea0ff) 8%, transparent);
  font-size: clamp(13px, 1.7cqw, 22px);
}
.fancy-title {
  margin-bottom: 0.5em;
  font-size: 1.05em;
  font-weight: 600;
  color: var(--snooze-accent, #5ea0ff);
  text-align: center;
}
table {
  border-collapse: collapse;
  text-align: center;
}
th, td {
  padding: 0.16em 0.4em;
  font-weight: 400;
}
th {
  opacity: 0.5;
  font-size: 0.8em;
}
td.dim { opacity: 0.28; }
td.today {
  color: #fff;
  font-weight: 700;
  background: var(--snooze-accent, #5ea0ff);
  border-radius: 50%;
}
.weeknum {
  opacity: 0.4;
  font-size: 0.76em;
}
</style>
