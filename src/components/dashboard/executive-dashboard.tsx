import {
  getDashboardStats,
  getStatusDistribution,
  getTasksByBusinessLine,
  getCompletionTrend,
} from "@/lib/data/analytics";
import { listEvaluations } from "@/lib/data/performance";
import { ExecutiveDashboardView } from "@/components/dashboard/executive-dashboard-view";

// Container: fetches exactly the data it always has, then hands it to the
// presentational view. Data set unchanged from before the recompose.
export async function ExecutiveDashboard() {
  const [stats, dist, byLine, trend, evals] = await Promise.all([
    getDashboardStats(),
    getStatusDistribution(),
    getTasksByBusinessLine(),
    getCompletionTrend(3),
    listEvaluations(),
  ]);

  return (
    <ExecutiveDashboardView
      stats={stats}
      dist={dist}
      byLine={byLine}
      trend={trend}
      evals={evals}
    />
  );
}
