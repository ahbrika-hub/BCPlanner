import "server-only";

import { getDashboardStats, type DashboardStats } from "@/lib/data/analytics";
import { getDelayedReport, type DelayedReport } from "@/lib/data/delayed";
import { getWorkloadForRange } from "@/lib/data/workload";
import { resolveWorkloadRange } from "@/lib/workload/compute";
import { todayDateString } from "@/lib/tasks/overdue";
import type { WorkloadRow } from "@/lib/data/types";

/**
 * Permission gate for the weekly management-review pack. `reports.read_all` is
 * held by exactly ceo + section_head + admin (employee holds only `reports.read`),
 * so it admits the three leadership roles and excludes employees — the same gate
 * the live delayed-tasks report already uses. No new permission key.
 */
export const REVIEW_PACK_PERMISSION = "reports.read_all";

export type ReviewPackData = {
  stats: DashboardStats;
  delayed: DelayedReport;
  workload: WorkloadRow[];
  workloadRange: { from: string; to: string };
  /** ISO timestamp the pack was assembled (shown as each section's "as of"). */
  asOf: string;
};

/**
 * Compose the weekly review pack by REUSING the exact live data sources — it
 * recomputes nothing:
 *   - KPIs    → getDashboardStats() (the executive/operational dashboard source)
 *   - delayed → getDelayedReport()  (the /reports/delayed source; canonical overdue rule)
 *   - workload→ getWorkloadForRange() (the /workload source; holiday-aware capacity)
 * Each source stays RLS-scoped to the caller, so role scoping is inherited.
 */
export async function getReviewPackData(asOf: string): Promise<ReviewPackData> {
  const range = resolveWorkloadRange("week", todayDateString());
  const [stats, delayed, workload] = await Promise.all([
    getDashboardStats(),
    getDelayedReport(),
    getWorkloadForRange({ from: range.from, to: range.to }),
  ]);
  return {
    stats,
    delayed,
    workload,
    workloadRange: { from: range.from, to: range.to },
    asOf,
  };
}
