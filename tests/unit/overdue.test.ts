import { describe, it, expect } from "vitest";

import { isOverdue, OVERDUE_EXCLUDED_STATUSES } from "@/lib/tasks/overdue";
import type { TaskStatus } from "@/lib/data/types";

// Build date strings relative to today so the test never goes stale.
function isoOffset(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const yesterday = isoOffset(-1);
const tomorrow = isoOffset(1);

describe("isOverdue (canonical derived rule)", () => {
  it("is overdue when due in the past and status is non-terminal", () => {
    expect(isOverdue(yesterday, "in_progress")).toBe(true);
    expect(isOverdue(yesterday, "assigned")).toBe(true);
  });

  it("is NOT overdue when due in the future", () => {
    expect(isOverdue(tomorrow, "in_progress")).toBe(false);
  });

  it("is NOT overdue with no due date", () => {
    expect(isOverdue(null, "in_progress")).toBe(false);
    expect(isOverdue(undefined, "assigned")).toBe(false);
  });

  it("is NOT overdue for terminal statuses even if past due", () => {
    for (const status of OVERDUE_EXCLUDED_STATUSES) {
      expect(isOverdue(yesterday, status)).toBe(false);
    }
  });

  it("excludes exactly completed, cancelled, rejected", () => {
    expect([...OVERDUE_EXCLUDED_STATUSES]).toEqual([
      "completed",
      "cancelled",
      "rejected",
    ] satisfies TaskStatus[]);
  });
});
