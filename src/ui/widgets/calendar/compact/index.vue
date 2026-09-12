<script setup lang="ts">
/**
 * 日历·紧凑月历（内置样式）。
 *
 * 与基础月历同为整月网格，但省略标题、压缩留白，适合空间受限的角落。
 * 从 options 读取：week_start、show_week_number。
 */
import { computed } from 'vue';
import { buildCalendarGrid, weekdayHeaders, isoWeekNumber } from '@/core/clock';
import type { WidgetProps } from '@/ui/widgets/types';

const props = defineProps<WidgetProps>();

const weekStart = computed<0 | 1>(() => (props.options.week_start === 0 ? 0 : 1));
const showWeekNumber = computed(() => props.options.show_week_number === true);

const grid = computed(() =>
  buildCalendarGrid(props.now.getFullYear(), props.now.getMonth(), weekStart.value),
);
const headers = computed(() => weekdayHeaders(weekStart.value));
</script>

<template>
  <div class="cal-compact">
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
.cal-compact {
  font-size: clamp(12px, 1.5cqw, 20px);
}
table {
  border-collapse: collapse;
  text-align: center;
}
th, td {
  padding: 0.1em 0.3em;
  font-weight: 400;
  line-height: 1.25;
}
th {
  opacity: 0.5;
  font-size: 0.78em;
}
td.dim { opacity: 0.28; }
td.today {
  color: var(--snooze-accent, #5ea0ff);
  font-weight: 700;
  border-radius: 50%;
  outline: 1px solid var(--snooze-accent, #5ea0ff);
  outline-offset: -1px;
}
.weeknum {
  opacity: 0.4;
  font-size: 0.74em;
}
</style>
