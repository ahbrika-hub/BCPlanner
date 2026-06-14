import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

import {
  aggregateDelayed,
  delayDays,
  type DelayedInput,
} from "@/lib/data/delayed";
import type { TaskStatus, TaskPriority } from "@/lib/data/types";

// "Delayed" MUST equal the canonical overdue predicate (reused from
// @/lib/tasks/overdue): due_date < today AND status not terminal. This proves
// the boundary cases and that grouping sums correctly.

// aggregateDelayed reads the real clock (todayDateString); freeze it to the
// fixture's TODAY so the boundary assertions are deterministic regardless of the
// calendar date the suite runs on.
beforeAll(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-06-13T12:00:00Z"));
});
afterAll(() => {
  vi.useRealTimers();
});

const TODAY = "2026-06-13";
const YESTERDAY = "2026-06-12";
const TOMORROW = "2026-06-14";

let seq = 0;
function mk(
  status: TaskStatus,
  due: string | null,
  opts: {
    assignee?: string | null;
    line?: string | null;
    priority?: TaskPriority;
  } = {},
): DelayedInput {
  seq += 1;
  return {
    id: `t${seq}`,
    task_no: `TSS-BC-2026-${String(seq).padStart(4, "0")}`,
    title: `Task ${seq}`,
    status,
    priority: opts.priority ?? "medium",
    due_date: due,
    assignee: opts.assignee === undefined ? null : { full_name: opts.assignee },
    business_line: opts.line == null ? null : { name: opts.line },
  };
}

describe("delayDays", () => {
  it("counts whole days late and never goes negative", () => {
    expect(delayDays(YESTERDAY, TODAY)).toBe(1);
    expect(delayDays("2026-06-03", TODAY)).toBe(10);
    expect(delayDays(TODAY, TODAY)).toBe(0); // due today is not late
    expect(delayDays(TOMORROW, TODAY)).toBe(0); // future clamps to 0
  });
});

describe("aggregateDelayed — canonical boundary", () => {
  it("treats due-yesterday + open as delayed", () => {
    const r = aggregateDelayed([mk("in_progress", YESTERDAY)], TODAY);
    expect(r.delayedCount).toBe(1);
    expect(r.tasks[0]!.delay_days).toBe(1);
  });

  it("treats due-tomorrow and due-today as on track, not delayed", () => {
    const r = aggregateDelayed(
      [mk("in_progress", TOMORROW), mk("assigned", TODAY)],
      TODAY,
    );
    expect(r.delayedCount).toBe(0);
    expect(r.onTrackCount).toBe(2);
  });

  it("excludes terminal statuses (completed/cancelled/rejected) even when past due", () => {
    const r = aggregateDelayed(
      [
        mk("completed", YESTERDAY),
        mk("cancelled", YESTERDAY),
        mk("rejected", YESTERDAY),
      ],
      TODAY,
    );
    expect(r.delayedCount).toBe(0);
    // terminal rows are neither delayed nor on-track
    expect(r.onTrackCount).toBe(0);
    expect(r.tasks).toHaveLength(0);
  });

  it("treats a null due_date as on track", () => {
    const r = aggregateDelayed([mk("assigned", null)], TODAY);
    expect(r.delayedCount).toBe(0);
    expect(r.onTrackCount).toBe(1);
  });
});

describe("aggregateDelayed — grouping sums", () => {
  const rows = [
    mk("in_progress", "2026-06-03", {
      assignee: "Alice",
      line: "Consulting",
      priority: "high",
    }), // delay 10
    mk("assigned", YESTERDAY, {
      assignee: "Alice",
      line: "Consulting",
      priority: "high",
    }), // delay 1
    mk("reopened", "2026-06-10", {
      assignee: "Bob",
      line: "Advisory",
      priority: "low",
    }), // delay 3
    mk("in_progress", TOMORROW, { assignee: "Bob" }), // on track
    mk("completed", YESTERDAY, { assignee: "Alice" }), // excluded
    mk("assigned", YESTERDAY, { assignee: null, line: null }), // Unassigned / Unassigned
  ];

  it("sums delayed/on-track and per-dimension breakdowns", () => {
    const r = aggregateDelayed(rows, TODAY);
    expect(r.delayedCount).toBe(4);
    expect(r.onTrackCount).toBe(1);
    expect(r.completion).toEqual([
      { label: "Delayed", count: 4 },
      { label: "On track", count: 1 },
    ]);

    // by employee (sorted desc by count, then label)
    expect(r.byEmployee).toEqual([
      { label: "Alice", count: 2 },
      { label: "Bob", count: 1 },
      { label: "Unassigned", count: 1 },
    ]);
    // by business line
    expect(r.byBusinessLine).toContainEqual({ label: "Consulting", count: 2 });
    expect(r.byBusinessLine).toContainEqual({ label: "Advisory", count: 1 });
    expect(r.byBusinessLine).toContainEqual({ label: "Unassigned", count: 1 });
    // by priority
    expect(r.byPriority).toContainEqual({ label: "high", count: 2 });

    // delay stats and ordering (most overdue first)
    expect(r.maxDelayDays).toBe(10);
    expect(r.tasks[0]!.delay_days).toBe(10);
    expect(r.avgDelayDays).toBe(
      Math.round(((10 + 1 + 3 + 1) / 4) * 10) / 10,
    );
  });
});
