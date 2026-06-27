import { describe, it, expect } from "vitest";

import {
  buildGantt,
  PX_PER_DAY,
  type GanttInputTask,
} from "@/lib/tasks/gantt";
import type { TaskStatus, TaskPriority } from "@/lib/data/types";

// The Gantt layout is pure: it turns RLS-scoped project tasks + dependency rows
// into bar geometry, arrows, and the unscheduled list. These tests pin the
// date-completeness rules (both / one / neither), internal-arrow scope, and the
// external-blocker handling — all without a database or React.

const TODAY = "2026-06-15";

function task(
  id: string,
  start: string | null,
  due: string | null,
  status: TaskStatus = "assigned",
  priority: TaskPriority = "medium",
): GanttInputTask {
  return { id, task_no: id.toUpperCase(), title: `Task ${id}`, status, priority, start_date: start, due_date: due };
}

describe("buildGantt — date completeness", () => {
  it("(a) both dates → a full bar spanning the range", () => {
    const { bars, unscheduled } = buildGantt(
      [task("a", "2026-06-10", "2026-06-14")],
      [],
      TODAY,
    );
    expect(unscheduled).toHaveLength(0);
    expect(bars).toHaveLength(1);
    expect(bars[0]?.isMarker).toBe(false);
    // 5 inclusive days → 5 * PX_PER_DAY wide.
    expect(bars[0]?.width).toBe(5 * PX_PER_DAY);
  });

  it("(b) only one date → a minimum-width single-day marker", () => {
    const dueOnly = buildGantt([task("b", null, "2026-06-12")], [], TODAY);
    expect(dueOnly.bars[0]?.isMarker).toBe(true);
    // A single date spans exactly one day.
    expect(dueOnly.bars[0]?.width).toBe(PX_PER_DAY);

    const startOnly = buildGantt([task("c", "2026-06-12", null)], [], TODAY);
    expect(startOnly.bars[0]?.isMarker).toBe(true);
  });

  it("(c) neither date → listed in Unscheduled, NOT dropped", () => {
    const { bars, unscheduled } = buildGantt([task("d", null, null)], [], TODAY);
    expect(bars).toHaveLength(0);
    expect(unscheduled.map((u) => u.id)).toEqual(["d"]);
  });

  it("marks an overdue bar via the canonical rule (vs injected today)", () => {
    const { bars } = buildGantt(
      [task("e", "2026-06-01", "2026-06-10", "in_progress")],
      [],
      TODAY, // due 06-10 < today 06-15, non-terminal → overdue
    );
    expect(bars[0]?.overdue).toBe(true);
  });
});

describe("buildGantt — dependency arrows", () => {
  const A = task("a", "2026-06-10", "2026-06-12"); // blocker
  const B = task("b", "2026-06-13", "2026-06-15"); // blocked

  it("draws an arrow blocker → blocked when both are in-project and scheduled", () => {
    const { arrows } = buildGantt([A, B], [{ task_id: "b", depends_on_task_id: "a" }], TODAY);
    expect(arrows).toHaveLength(1);
    expect(arrows[0]).toMatchObject({ fromId: "a", toId: "b" });
    // Arrow leaves the blocker's right edge and enters the blocked's left edge.
    expect(arrows[0]!.x1).toBeGreaterThan(0);
    expect(arrows[0]!.x2).toBeGreaterThanOrEqual(0);
  });

  it("does NOT draw an arrow when an endpoint is unscheduled", () => {
    const bNoDates = task("b", null, null);
    const { arrows } = buildGantt([A, bNoDates], [{ task_id: "b", depends_on_task_id: "a" }], TODAY);
    expect(arrows).toHaveLength(0);
  });

  it("external blocker (out-of-project end) → flags the in-project task, draws no off-chart arrow", () => {
    // Dependency: in-project B is blocked by 'ext' which is NOT in the task set.
    const { bars, arrows } = buildGantt(
      [B],
      [{ task_id: "b", depends_on_task_id: "ext" }],
      TODAY,
    );
    expect(arrows).toHaveLength(0); // nothing off-chart
    expect(bars.find((x) => x.id === "b")?.hasExternalBlocker).toBe(true);
  });

  it("an in-project task with no external dep is not flagged", () => {
    const { bars } = buildGantt([A, B], [{ task_id: "b", depends_on_task_id: "a" }], TODAY);
    expect(bars.every((x) => x.hasExternalBlocker === false)).toBe(true);
  });
});

describe("buildGantt — window + ordering", () => {
  it("orders rows by start date and produces month gridlines", () => {
    const { bars, gridlines, windowStart, windowEnd } = buildGantt(
      [task("late", "2026-07-02", "2026-07-04"), task("early", "2026-06-10", "2026-06-12")],
      [],
      TODAY,
    );
    expect(bars.map((b) => b.id)).toEqual(["early", "late"]);
    expect(windowStart <= "2026-06-10").toBe(true);
    expect(windowEnd >= "2026-07-04").toBe(true);
    expect(gridlines.length).toBeGreaterThanOrEqual(1); // at least the Jul 2026 boundary
  });

  it("falls back to a today-centered window when nothing is scheduled", () => {
    const { bars, unscheduled, width } = buildGantt([task("x", null, null)], [], TODAY);
    expect(bars).toHaveLength(0);
    expect(unscheduled).toHaveLength(1);
    expect(width).toBeGreaterThan(0);
  });
});
