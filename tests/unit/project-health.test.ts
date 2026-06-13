import { describe, it, expect } from "vitest";

import {
  aggregateProjectHealth,
  type ProjectHealthInput,
} from "@/lib/data/project-health";
import type { TaskStatus } from "@/lib/data/types";

// Rollup correctness + the canonical overdue boundary (reused from
// @/lib/tasks/overdue): overdue = past-due AND non-terminal status.

function dateOffset(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
const YESTERDAY = dateOffset(-1);
const TOMORROW = dateOffset(1);

function t(
  status: TaskStatus,
  due: string | null,
  progress: number | null,
  quality: number | null = null,
): ProjectHealthInput {
  return {
    status,
    due_date: due,
    progress_percentage: progress,
    quality_rating: quality,
  };
}

describe("aggregateProjectHealth", () => {
  it("computes every count, completion %, and averages", () => {
    const rows: ProjectHealthInput[] = [
      t("completed", YESTERDAY, 100, 5),
      t("completed", null, 100, 3),
      t("in_progress", YESTERDAY, 40), // overdue
      t("in_progress", TOMORROW, 20), // not overdue
      t("pending_review", YESTERDAY, 90), // overdue
      t("assigned", null, 0),
    ];
    const h = aggregateProjectHealth(rows);
    expect(h.total).toBe(6);
    expect(h.completed).toBe(2);
    expect(h.inProgress).toBe(2);
    expect(h.pendingReview).toBe(1);
    expect(h.overdue).toBe(2);
    expect(h.completionPct).toBe(33); // round(2/6*100)
    expect(h.avgProgress).toBe(58); // round(350/6)
    expect(h.avgQuality).toBe(4); // mean(5,3)
  });

  it("counts overdue by the canonical predicate (terminal states excluded)", () => {
    const rows: ProjectHealthInput[] = [
      t("in_progress", YESTERDAY, 10), // overdue
      t("completed", YESTERDAY, 100), // terminal → not overdue
      t("cancelled", YESTERDAY, 0), // terminal → not overdue
      t("rejected", YESTERDAY, 0), // terminal → not overdue
      t("assigned", TOMORROW, 0), // future → not overdue
      t("assigned", null, 0), // no due date → not overdue
    ];
    expect(aggregateProjectHealth(rows).overdue).toBe(1);
  });

  it("returns null avg quality when nothing is rated, and zeroes on an empty project", () => {
    expect(aggregateProjectHealth([t("assigned", null, 50)]).avgQuality).toBeNull();
    const empty = aggregateProjectHealth([]);
    expect(empty).toMatchObject({
      total: 0,
      completionPct: 0,
      avgProgress: 0,
      avgQuality: null,
      overdue: 0,
    });
  });
});
