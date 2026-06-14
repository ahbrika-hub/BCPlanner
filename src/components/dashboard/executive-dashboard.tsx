import {
  getDashboardStats,
  getStatusDistribution,
  getTasksByBusinessLine,
  getCompletionTrend,
} from "@/lib/data/analytics";
import { ExecutiveDashboardView } from "@/components/dashboard/executive-dashboard-view";

// Container: fetches the aggregate analytics the read-only executive overview
// needs. No per-employee evaluations (the CEO no longer holds performance
// access) and no task-level drill-down data.
export async function ExecutiveDashboard() {
  const [stats, dist, byLine, trend] = await Promise.all([
    getDashboardStats(),
    getStatusDistribution(),
    getTasksByBusinessLine(),
    getCompletionTrend(3),
  ]);

  return (
    <ExecutiveDashboardView
      stats={stats}
      dist={dist}
      byLine={byLine}
      trend={trend}
    />
  );
}
