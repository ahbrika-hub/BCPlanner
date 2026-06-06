import { ListTodo, CheckCircle2, AlertTriangle, Star } from "lucide-react";

import {
  getDashboardStats,
  getStatusDistribution,
  getTasksByBusinessLine,
  getCompletionTrend,
} from "@/lib/data/analytics";
import { listEvaluations } from "@/lib/data/performance";
import { KpiCard } from "@/components/charts/kpi-card";
import { StatusDistributionChart } from "@/components/charts/status-distribution-chart";
import { BarComparisonChart } from "@/components/charts/bar-comparison-chart";
import { TasksOverTimeChart } from "@/components/charts/tasks-over-time-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

export async function ExecutiveDashboard() {
  const [stats, dist, byLine, trend, evals] = await Promise.all([
    getDashboardStats(),
    getStatusDistribution(),
    getTasksByBusinessLine(),
    getCompletionTrend(3),
    listEvaluations(),
  ]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Active tasks" value={stats.active} icon={ListTodo} />
        <KpiCard
          label="Completion rate"
          value={`${stats.completionRate}%`}
          icon={CheckCircle2}
          accent="var(--color-status-completed)"
        />
        <KpiCard
          label="Overdue"
          value={stats.overdue}
          icon={AlertTriangle}
          accent="var(--color-danger)"
        />
        <KpiCard
          label="Avg quality"
          value={stats.avgQuality ?? "—"}
          icon={Star}
          accent="var(--color-warning)"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Status distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <StatusDistributionChart data={dist} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>By business line</CardTitle>
          </CardHeader>
          <CardContent>
            <BarComparisonChart data={byLine} color="var(--secondary)" />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Completion trend</CardTitle>
        </CardHeader>
        <CardContent>
          <TasksOverTimeChart data={trend} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Team performance</CardTitle>
        </CardHeader>
        <CardContent>
          {evals.length === 0 ? (
            <EmptyState
              title="No evaluations yet"
              description="Performance evaluations will appear here once recorded."
            />
          ) : (
            <ul className="divide-y">
              {evals.slice(0, 8).map((e) => (
                <li
                  key={e.id}
                  className="flex items-center justify-between py-2"
                >
                  <span className="text-sm">
                    {e.employee?.full_name ?? "—"}{" "}
                    <span className="text-muted-foreground">· {e.period}</span>
                  </span>
                  <span className="font-semibold">
                    {e.overall_score ?? "—"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
