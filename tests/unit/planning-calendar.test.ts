import { describe, it, expect } from "vitest";

import {
  splitByDueDate,
  buildCalendarMonth,
  addMonths,
} from "@/lib/tasks/calendar";
import type { TaskWithRelations, TaskStatus } from "@/lib/data/types";

// The calendar is a read-only plot of tasks on due_date. These tests pin the
// pure bucketing: dated vs undated, the correct day cell, overdue marking (the
// canonical rule), and a whole-weeks grid. There is no write path to test —
// the helpers take already-fetched (RLS-scoped) rows and only group them.

const TODAY = "2026-06-27";

function task(
  id: string,
  due_date: string | null,
  status: TaskStatus = "in_progress",
): TaskWithRelations {
  return {
    id,
    task_no: id.toUpperCase(),
    title: `Task ${id}`,
    status,
    priority: "medium",
    due_date,
  } as unknown as TaskWithRelations;
}

describe("splitByDueDate", () => {
  it("separates tasks with a due_date from those without", () => {
    const { dated, undated } = splitByDueDate(
      [task("a", "2026-06-15"), task("b", null), task("c", "2026-06-15")],
      TODAY,
    );
    expect(undated.map((t) => t.id)).toEqual(["b"]);
    expect(dated.get("2026-06-15")?.map((t) => t.id)).toEqual(["a", "c"]);
  });

  it("marks overdue against the injected reference date (terminal statuses excluded)", () => {
    const { dated } = splitByDueDate(
      [
        task("past", "2026-06-15", "in_progress"), // before TODAY → overdue
        task("done", "2026-06-15", "completed"), // terminal → never overdue
        task("future", "2026-12-01", "in_progress"), // after TODAY → not overdue
      ],
      TODAY,
    );
    const day = dated.get("2026-06-15") ?? [];
    expect(day.find((t) => t.id === "past")?.overdue).toBe(true);
    expect(day.find((t) => t.id === "done")?.overdue).toBe(false);
    expect(dated.get("2026-12-01")?.[0]?.overdue).toBe(false);
  });
});

describe("buildCalendarMonth", () => {
  it("produces whole Sunday-first weeks (each length 7)", () => {
    const { calendar } = buildCalendarMonth(2026, 5 /* June */, [], TODAY);
    expect(calendar.weeks.length).toBeGreaterThanOrEqual(4);
    for (const week of calendar.weeks) expect(week).toHaveLength(7);
    // The grid starts on a Sunday cell.
    expect(calendar.weeks[0]?.[0]?.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("plots a task on its due_date cell and flags it in-month", () => {
    const { calendar } = buildCalendarMonth(
      2026,
      5,
      [task("x", "2026-06-15")],
      TODAY,
    );
    const cells = calendar.weeks.flat();
    const cell = cells.find((c) => c.date === "2026-06-15");
    expect(cell?.inMonth).toBe(true);
    expect(cell?.tasks.map((t) => t.id)).toEqual(["x"]);
  });

  it("marks the today cell", () => {
    const { calendar } = buildCalendarMonth(2026, 5, [], TODAY);
    const today = calendar.weeks.flat().find((c) => c.isToday);
    expect(today?.date).toBe(TODAY);
    expect(today?.inMonth).toBe(true);
  });

  it("returns undated tasks separately (not dropped, not plotted)", () => {
    const { calendar, undated } = buildCalendarMonth(
      2026,
      5,
      [task("n", null), task("d", "2026-06-10")],
      TODAY,
    );
    expect(undated.map((t) => t.id)).toEqual(["n"]);
    // The undated task is nowhere on the grid.
    const plotted = calendar.weeks.flat().flatMap((c) => c.tasks.map((t) => t.id));
    expect(plotted).not.toContain("n");
    expect(plotted).toContain("d");
  });

  it("does not plot a task whose due_date is in another month onto this grid's in-month days", () => {
    const { calendar } = buildCalendarMonth(
      2026,
      5,
      [task("july", "2026-07-20")],
      TODAY,
    );
    const inMonthWithTask = calendar.weeks
      .flat()
      .filter((c) => c.inMonth)
      .some((c) => c.tasks.length > 0);
    expect(inMonthWithTask).toBe(false);
  });
});

describe("addMonths", () => {
  it("wraps December → January and back", () => {
    expect(addMonths(2026, 11, 1)).toEqual({ year: 2027, month: 0 });
    expect(addMonths(2026, 0, -1)).toEqual({ year: 2025, month: 11 });
    expect(addMonths(2026, 5, 0)).toEqual({ year: 2026, month: 5 });
  });
});
