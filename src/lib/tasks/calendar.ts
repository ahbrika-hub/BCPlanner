import { isOverdue } from "@/lib/tasks/overdue";
import type { TaskWithRelations } from "@/lib/data/types";

/**
 * Pure helpers for the read-only planning calendar. No React, no data access —
 * they take already-fetched (RLS-scoped) tasks and bucket them by `due_date` so
 * the component is a thin renderer and the bucketing is unit-testable.
 *
 * Tasks WITHOUT a due_date cannot be plotted on a day; they are returned
 * separately (see {@link splitByDueDate}) and the UI lists them in a small
 * "No due date" area beneath the grid (documented choice — they are NOT
 * silently dropped). Overdue is the canonical derived rule (see overdue.ts).
 */

export type CalendarTask = Pick<
  TaskWithRelations,
  "id" | "task_no" | "title" | "status" | "priority" | "due_date"
> & { overdue: boolean };

export type CalendarDay = {
  /** `YYYY-MM-DD` for this cell. */
  date: string;
  /** Day of month (1–31). */
  day: number;
  /** False for leading/trailing days that belong to an adjacent month. */
  inMonth: boolean;
  /** True when this cell is the reference "today". */
  isToday: boolean;
  tasks: CalendarTask[];
};

export type CalendarMonth = {
  year: number;
  /** 0-based month index (0 = January), matching JS Date semantics. */
  month: number;
  /** Calendar weeks (each length 7, Sunday-first) covering the month. */
  weeks: CalendarDay[][];
};

/** `YYYY-MM-DD` for a Y/M(0-based)/D triple, zero-padded, no timezone math. */
function ymd(year: number, month: number, day: number): string {
  const m = String(month + 1).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${year}-${m}-${d}`;
}

/** Project a task row to the slim calendar shape, deriving `overdue` against the
 * injected reference date so it matches the same render's `isToday` marker. */
function toCalendarTask(
  t: CalendarTask | TaskWithRelations,
  todayStr: string,
): CalendarTask {
  return {
    id: t.id,
    task_no: t.task_no,
    title: t.title,
    status: t.status,
    priority: t.priority,
    due_date: t.due_date,
    overdue: isOverdue(t.due_date, t.status, todayStr),
  };
}

/**
 * Partition tasks into those with a plottable due_date and those without.
 * `dated` keys are `YYYY-MM-DD` → tasks due that day (sorted by task_no for a
 * stable render); `undated` preserves input order. `todayStr` (`YYYY-MM-DD`) is
 * the reference date overdue is derived against.
 */
export function splitByDueDate(
  tasks: TaskWithRelations[],
  todayStr: string,
): {
  dated: Map<string, CalendarTask[]>;
  undated: CalendarTask[];
} {
  const dated = new Map<string, CalendarTask[]>();
  const undated: CalendarTask[] = [];
  for (const raw of tasks) {
    const t = toCalendarTask(raw, todayStr);
    if (!t.due_date) {
      undated.push(t);
      continue;
    }
    // due_date is a `date` column → `YYYY-MM-DD`; take the first 10 chars so an
    // accidental timestamp still buckets on the calendar day.
    const key = t.due_date.slice(0, 10);
    const bucket = dated.get(key);
    if (bucket) bucket.push(t);
    else dated.set(key, [t]);
  }
  for (const bucket of dated.values()) {
    bucket.sort((a, b) => (a.task_no ?? "").localeCompare(b.task_no ?? ""));
  }
  return { dated, undated };
}

/**
 * Build a Sunday-first month grid for `year`/`month` (0-based), distributing the
 * dated tasks into day cells. The grid always contains whole weeks, so it
 * includes the trailing days of the previous month and leading days of the next
 * (marked `inMonth: false`). `todayStr` is injected (`YYYY-MM-DD`) so the helper
 * is deterministic/testable.
 */
export function buildCalendarMonth(
  year: number,
  month: number,
  tasks: TaskWithRelations[],
  todayStr: string,
): { calendar: CalendarMonth; undated: CalendarTask[] } {
  const { dated, undated } = splitByDueDate(tasks, todayStr);

  const firstOfMonth = new Date(Date.UTC(year, month, 1));
  const startDow = firstOfMonth.getUTCDay(); // 0 = Sunday
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const daysInPrev = new Date(Date.UTC(year, month, 0)).getUTCDate();

  const cells: CalendarDay[] = [];

  // Leading days from the previous month.
  for (let i = startDow - 1; i >= 0; i--) {
    const day = daysInPrev - i;
    const prevMonth = month === 0 ? 11 : month - 1;
    const prevYear = month === 0 ? year - 1 : year;
    const date = ymd(prevYear, prevMonth, day);
    cells.push({
      date,
      day,
      inMonth: false,
      isToday: date === todayStr,
      tasks: dated.get(date) ?? [],
    });
  }

  // Days of the current month.
  for (let day = 1; day <= daysInMonth; day++) {
    const date = ymd(year, month, day);
    cells.push({
      date,
      day,
      inMonth: true,
      isToday: date === todayStr,
      tasks: dated.get(date) ?? [],
    });
  }

  // Trailing days to complete the final week.
  let nextDay = 1;
  while (cells.length % 7 !== 0) {
    const nextMonth = month === 11 ? 0 : month + 1;
    const nextYear = month === 11 ? year + 1 : year;
    const date = ymd(nextYear, nextMonth, nextDay);
    cells.push({
      date,
      day: nextDay,
      inMonth: false,
      isToday: date === todayStr,
      tasks: dated.get(date) ?? [],
    });
    nextDay++;
  }

  const weeks: CalendarDay[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }

  return { calendar: { year, month, weeks }, undated };
}

export const WEEKDAY_LABELS = [
  "Sun",
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
] as const;

const MONTH_LABELS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

/** Human heading for a year/month (0-based), e.g. (2026, 5) → "June 2026". */
export function monthLabel(year: number, month: number): string {
  return `${MONTH_LABELS[month]} ${year}`;
}

/** Clamp/normalize a (year, monthDelta) step into a valid year/month pair. */
export function addMonths(
  year: number,
  month: number,
  delta: number,
): { year: number; month: number } {
  const total = year * 12 + month + delta;
  return { year: Math.floor(total / 12), month: ((total % 12) + 12) % 12 };
}
