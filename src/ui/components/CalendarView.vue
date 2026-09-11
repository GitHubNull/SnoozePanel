<script setup lang="ts">
import { computed } from 'vue';
import { buildCalendarGrid, weekdayHeaders, isoWeekNumber, formatDate } from '@/core/clock';

const props = defineProps<{
  now: Date;
  weekStart: 0 | 1;
  showWeekNumber: boolean;
  format: string;
}>();

const grid = computed(() =>
  buildCalendarGrid(props.now.getFullYear(), props.now.getMonth(), props.weekStart),
);
const headers = computed(() => weekdayHeaders(props.weekStart));
const title = computed(() => formatDate(props.now, props.format));
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
  font-size: clamp(14px, 1.8vw, 24px);
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
