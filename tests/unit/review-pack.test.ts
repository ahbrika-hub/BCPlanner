import { describe, it, expect, beforeEach, vi } from "vitest";

// The review pack must REUSE the live data sources (no recompute / no fork). These
// tests prove getReviewPackData delegates to the exact same helpers the live
// dashboard, delayed report, and workload page use, and passes their output
// through unchanged.
const analytics = vi.hoisted(() => ({ getDashboardStats: vi.fn() }));
const delayed = vi.hoisted(() => ({ getDelayedReport: vi.fn() }));
const workload = vi.hoisted(() => ({ getWorkloadForRange: vi.fn() }));

vi.mock("@/lib/data/analytics", () => analytics);
vi.mock("@/lib/data/delayed", () => delayed);
vi.mock("@/lib/data/workload", () => workload);

import {
  getReviewPackData,
  REVIEW_PACK_PERMISSION,
} from "@/lib/data/review-pack";

const STATS = { active: 7, completionRate: 80, overdue: 2 };
const DELAYED = { delayedCount: 2, onTrackCount: 5, tasks: [] };
const WORKLOAD = [{ employee_id: "u1", utilization_pct: 90 }];

beforeEach(() => {
  vi.clearAllMocks();
  analytics.getDashboardStats.mockResolvedValue(STATS);
  delayed.getDelayedReport.mockResolvedValue(DELAYED);
  workload.getWorkloadForRange.mockResolvedValue(WORKLOAD);
});

describe("getReviewPackData (no recompute — shared sources)", () => {
  it("delegates to the live helpers and passes their output through unchanged", async () => {
    const asOf = "2026-06-27T00:00:00.000Z";
    const res = await getReviewPackData(asOf);

    expect(analytics.getDashboardStats).toHaveBeenCalledTimes(1);
    expect(delayed.getDelayedReport).toHaveBeenCalledTimes(1);
    expect(workload.getWorkloadForRange).toHaveBeenCalledTimes(1);

    // Equality with the live sources' output = same source, not a fork.
    expect(res.stats).toBe(STATS);
    expect(res.delayed).toBe(DELAYED);
    expect(res.workload).toBe(WORKLOAD);
    expect(res.asOf).toBe(asOf);
    // Workload is fetched for a resolved week range (from ≤ to).
    expect(res.workloadRange.from <= res.workloadRange.to).toBe(true);
    expect(workload.getWorkloadForRange).toHaveBeenCalledWith(res.workloadRange);
  });

  it("gates on reports.read_all (ceo + section_head + admin; excludes employee)", () => {
    expect(REVIEW_PACK_PERMISSION).toBe("reports.read_all");
  });
});
