import {
  getDashboardStats,
  getStatusDistribution,
  getCompletionTrend,
  getOverdueTasks,
  getRecentActivity,
} from "@/lib/data/analytics";
import { getWorkload } from "@/lib/data/workload";
import { OperationalDashboardView } from "@/components/dashboard/operational-dashboard-view";

// Container: same queries as before the recompose; hands data to the view.
export async function OperationalDashboard() {
  const [stats, dist, trend, overdue, recent, workload] = await Promise.all([
    getDashboardStats(),
    getStatusDistribution(),
    getCompletionTrend(3),
    getOverdueTasks(8),
    getRecentActivity(8),
    getWorkload(),
  ]);

  return (
    <OperationalDashboardView
      stats={stats}
      dist={dist}
      trend={trend}
      overdue={overdue}
      recent={recent}
      workload={workload}
    />
  );
}
