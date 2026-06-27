import { isOverdue } from "@/lib/tasks/overdue";
import type { TaskStatus, TaskPriority } from "@/lib/data/types";

/**
 * Pure layout for the read-only per-project Gantt. Takes already-fetched
 * (RLS-scoped) project tasks + the dependency rows touching them, and produces
 * absolute-positioned bar geometry, month gridlines, dependency arrows, and the
 * unscheduled list. No React, no data access — so it's unit-testable and the
 * component is a thin renderer. Nothing here writes.
 *
 * Date-completeness (documented, never silently dropped):
 *   • start + due  → a full bar spanning [start, due].
 *   • only one date → a minimum-width single-day MARKER at the known date.
 *   • neither       → excluded from the chart and returned in `unscheduled`.
 *
 * Dependency arrows are drawn only when BOTH ends are in-project AND scheduled
 * (an arrow needs two positioned bars). A dependency whose other end is outside
 * this project's task set (but still visible — RLS already hides rows whose ends
 * the caller can't see) marks the in-project blocked task with an "external
 * blocker" flag instead of drawing an off-chart arrow (no cross-project detail
 * leaked, no clutter).
 */

export type GanttInputTask = {
  id: string;
  task_no: string | null;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  start_date: string | null;
  due_date: string | null;
};

export type GanttInputDependency = {
  task_id: string; // blocked
  depends_on_task_id: string; // blocker
};

export type GanttBar = {
  id: string;
  task_no: string | null;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  /** Left offset in px from the chart's left edge. */
  x: number;
  /** Bar width in px (≥ MIN_BAR_PX). */
  width: number;
  /** Row index (0-based) — vertical order. */
  row: number;
  /** True for a single-date task (rendered as a marker, not a span). */
  isMarker: boolean;
  overdue: boolean;
  /** True when an out-of-project (but visible) task blocks this one. */
  hasExternalBlocker: boolean;
};

export type GanttArrow = {
  fromId: string; // blocker bar
  toId: string; // blocked bar
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

export type GanttGridline = { x: number; label: string };

export type GanttLayout = {
  bars: GanttBar[];
  unscheduled: {
    id: string;
    task_no: string | null;
    title: string;
    status: TaskStatus;
    priority: TaskPriority;
  }[];
  arrows: GanttArrow[];
  gridlines: GanttGridline[];
  /** Total chart dimensions in px. */
  width: number;
  height: number;
  rowHeight: number;
  pxPerDay: number;
  /** Window bounds as YYYY-MM-DD (inclusive), for the axis caption. */
  windowStart: string;
  windowEnd: string;
};

export const PX_PER_DAY = 28;
export const ROW_HEIGHT = 36;
export const MIN_BAR_PX = 14;
const WINDOW_PAD_DAYS = 2;

/** Day index (days since the Unix epoch, UTC) for a YYYY-MM-DD string. */
function dayIndex(ymd: string): number {
  const [y, m, d] = ymd.slice(0, 10).split("-").map(Number);
  return Math.floor(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1) / 86_400_000);
}

/** YYYY-MM-DD for a day index. */
function ymdFromIndex(idx: number): string {
  return new Date(idx * 86_400_000).toISOString().slice(0, 10);
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** The scheduling span of a task in day indices, or null if unscheduled. */
function spanOf(t: GanttInputTask): { from: number; to: number; marker: boolean } | null {
  const s = t.start_date ? dayIndex(t.start_date) : null;
  const d = t.due_date ? dayIndex(t.due_date) : null;
  if (s !== null && d !== null) return { from: Math.min(s, d), to: Math.max(s, d), marker: false };
  if (s !== null) return { from: s, to: s, marker: true };
  if (d !== null) return { from: d, to: d, marker: true };
  return null;
}

export function buildGantt(
  tasks: GanttInputTask[],
  dependencies: GanttInputDependency[],
  todayStr: string,
): GanttLayout {
  const inProject = new Set(tasks.map((t) => t.id));

  // Which in-project tasks have an out-of-project (still visible) blocker.
  const externalBlocked = new Set<string>();
  for (const dep of dependencies) {
    const blockedIn = inProject.has(dep.task_id);
    const blockerIn = inProject.has(dep.depends_on_task_id);
    if (blockedIn && !blockerIn) externalBlocked.add(dep.task_id);
  }

  // Partition scheduled vs unscheduled, preserving a stable order: by start day
  // then task_no.
  const scheduled: { t: GanttInputTask; from: number; to: number; marker: boolean }[] = [];
  const unscheduled: GanttLayout["unscheduled"] = [];
  for (const t of tasks) {
    const span = spanOf(t);
    if (!span) {
      unscheduled.push({
        id: t.id,
        task_no: t.task_no,
        title: t.title,
        status: t.status,
        priority: t.priority,
      });
    } else {
      scheduled.push({ t, ...span });
    }
  }
  scheduled.sort(
    (a, b) => a.from - b.from || (a.t.task_no ?? "").localeCompare(b.t.task_no ?? ""),
  );

  // Window: min start … max end across scheduled tasks (padded), or today when
  // nothing is scheduled.
  let windowStartIdx: number;
  let windowEndIdx: number;
  if (scheduled.length > 0) {
    windowStartIdx = Math.min(...scheduled.map((s) => s.from)) - WINDOW_PAD_DAYS;
    windowEndIdx = Math.max(...scheduled.map((s) => s.to)) + WINDOW_PAD_DAYS;
  } else {
    windowStartIdx = dayIndex(todayStr) - WINDOW_PAD_DAYS;
    windowEndIdx = dayIndex(todayStr) + WINDOW_PAD_DAYS;
  }
  const totalDays = windowEndIdx - windowStartIdx + 1;
  const width = totalDays * PX_PER_DAY;
  const height = scheduled.length * ROW_HEIGHT;

  const barById = new Map<string, GanttBar>();
  const bars: GanttBar[] = scheduled.map((s, row) => {
    const x = (s.from - windowStartIdx) * PX_PER_DAY;
    const rawWidth = (s.to - s.from + 1) * PX_PER_DAY;
    const bar: GanttBar = {
      id: s.t.id,
      task_no: s.t.task_no,
      title: s.t.title,
      status: s.t.status,
      priority: s.t.priority,
      x,
      width: Math.max(rawWidth, MIN_BAR_PX),
      row,
      isMarker: s.marker,
      overdue: isOverdue(s.t.due_date, s.t.status, todayStr),
      hasExternalBlocker: externalBlocked.has(s.t.id),
    };
    barById.set(bar.id, bar);
    return bar;
  });

  // Internal arrows: blocker → blocked, both scheduled & in-project.
  const arrows: GanttArrow[] = [];
  for (const dep of dependencies) {
    const blocker = barById.get(dep.depends_on_task_id);
    const blocked = barById.get(dep.task_id);
    if (!blocker || !blocked) continue; // one end unscheduled or out-of-project
    arrows.push({
      fromId: blocker.id,
      toId: blocked.id,
      x1: blocker.x + blocker.width,
      y1: blocker.row * ROW_HEIGHT + ROW_HEIGHT / 2,
      x2: blocked.x,
      y2: blocked.row * ROW_HEIGHT + ROW_HEIGHT / 2,
    });
  }

  // Month gridlines: first-of-month within the window.
  const gridlines: GanttGridline[] = [];
  const start = new Date(windowStartIdx * 86_400_000);
  let gy = start.getUTCFullYear();
  let gm = start.getUTCMonth();
  // Advance to the first month boundary ≥ window start.
  if (start.getUTCDate() !== 1) {
    gm += 1;
    if (gm > 11) { gm = 0; gy += 1; }
  }
  for (;;) {
    const idx = Math.floor(Date.UTC(gy, gm, 1) / 86_400_000);
    if (idx > windowEndIdx) break;
    gridlines.push({
      x: (idx - windowStartIdx) * PX_PER_DAY,
      label: `${MONTHS[gm]} ${gy}`,
    });
    gm += 1;
    if (gm > 11) { gm = 0; gy += 1; }
  }

  return {
    bars,
    unscheduled,
    arrows,
    gridlines,
    width,
    height,
    rowHeight: ROW_HEIGHT,
    pxPerDay: PX_PER_DAY,
    windowStart: ymdFromIndex(windowStartIdx),
    windowEnd: ymdFromIndex(windowEndIdx),
  };
}
