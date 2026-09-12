<script setup lang="ts">
/**
 * 日历内容组件（内置）。
 *
 * 从 options 读取：week_start（0=周日 1=周一）、show_week_number、format（日期标题模板）。
 * 第三方如需自定义，可在 widgets/thirdparty/calendar/ 放同 id 目录整体替换。
 */
import { computed } from 'vue';
import { buildCalendarGrid, weekdayHeaders, isoWeekNumber, formatDate } from '@/core/clock';
import type { WidgetProps } from '../types';

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
  <div class="calendar">
    <div class="cal-title">{{ title }}</div>
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
.calendar {
  font-size: clamp(14px, 1.8cqw, 24px);
}
.cal-title {
  margin-bottom: 0.6em;
  font-size: 1.1em;
  opacity: 0.9;
}
table {
  border-collapse: collapse;
  text-align: center;
}
th, td {
  padding: 0.18em 0.42em;
  font-weight: 400;
}
th {
  opacity: 0.55;
  font-size: 0.82em;
}
td.dim { opacity: 0.3; }
td.today {
  color: var(--snooze-accent, #5ea0ff);
  font-weight: 700;
  border-radius: 50%;
  outline: 1px solid var(--snooze-accent, #5ea0ff);
  outline-offset: -1px;
}
.weeknum {
  opacity: 0.45;
  font-size: 0.78em;
}
</style>
