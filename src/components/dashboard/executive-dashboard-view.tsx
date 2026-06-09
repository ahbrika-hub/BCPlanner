// Client component: it renders interactive drill-downs (DrilldownKpi,
// StatusDistributionDrilldown) and passes Lucide icon components to them, so the
// whole view must live on the client — a Server Component cannot pass a function
// (the icon) across the RSC boundary to a Client Component. Data still arrives
// as serializable props from the async server container.
"use client";

import { ListTodo, CheckCircle2, AlertTriangle, Star } from "lucide-react";

import type {
  getDashboardStats,
  getStatusDistribution,
  getTasksByBusinessLine,
  getCompletionTrend,
} from "@/lib/data/analytics";
import type { listEvaluations } from "@/lib/data/performance";
import { KpiCard } from "@/components/ui/kpi-card";
import { TokenPill } from "@/components/ui/token-pill";
import { DrilldownKpi } from "@/components/dashboard/drilldown-kpi";
import { StatusDistributionDrilldown } from "@/components/dashboard/status-distribution-drilldown";
import { BarComparisonChart } from "@/components/charts/bar-comparison-chart";
import { TasksOverTimeChart } from "@/components/charts/tasks-over-time-chart";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type ExecutiveDashboardData = {
  stats: Awaited<ReturnType<typeof getDashboardStats>>;
  dist: Awaited<ReturnType<typeof getStatusDistribution>>;
  byLine: Awaited<ReturnType<typeof getTasksByBusinessLine>>;
  trend: Awaited<ReturnType<typeof getCompletionTrend>>;
  evals: Awaited<ReturnType<typeof listEvaluations>>;
};

// Presentational score → colour band (derived from the already-fetched score).
function scoreColor(score: number | null): string {
  if (score === null) return "var(--color-muted-foreground)";
  if (score >= 4.5) return "var(--color-success)";
  if (score >= 3.5) return "var(--color-info)";
  if (score >= 2.5) return "var(--color-warning)";
  return "var(--color-danger)";
}

export function ExecutiveDashboardView({
  stats,
  dist,
  byLine,
  trend,
  evals,
}: ExecutiveDashboardData) {
  return (
    // Comfortable executive reading column on wide screens.
    <div className="mx-auto max-w-5xl space-y-8">
      {/* Lead: headline metrics (F-pattern top row). */}
      <section
        aria-label="Key metrics"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <DrilldownKpi
          label="Active tasks"
          value={stats.active}
          icon={ListTodo}
          drilldown={{ kind: "active" }}
          title="Active tasks"
          description="Tasks currently in flight."
        />
        <DrilldownKpi
          label="Completion rate"
          value={`${stats.completionRate}%`}
          icon={CheckCircle2}
          accent="var(--color-status-completed)"
          drilldown={{ kind: "status", status: "completed" }}
          title="Completed tasks"
          description="Tasks that have been completed."
          viewAllHref="/tasks?status=completed"
        />
        <DrilldownKpi
          label="Overdue"
          value={stats.overdue}
          icon={AlertTriangle}
          accent="var(--color-danger)"
          drilldown={{ kind: "overdue" }}
          title="Overdue tasks"
          description="Past due and not yet completed."
        />
        <KpiCard
          label="Avg quality"
          value={stats.avgQuality ?? "—"}
          icon={Star}
          accent="var(--color-warning)"
          hint="out of 5"
        />
      </section>

      {/* Composition + trend, side by side. */}
      <section
        aria-label="Distribution and trend"
        className="grid gap-6 lg:grid-cols-2"
      >
        <Card>
          <CardHeader>
            <CardTitle>Status distribution</CardTitle>
            <CardDescription>Where work sits right now</CardDescription>
          </CardHeader>
          <CardContent>
            <StatusDistributionDrilldown data={dist} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Completion trend</CardTitle>
            <CardDescription>
              Created vs completed, last 3 months
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TasksOverTimeChart data={trend} />
          </CardContent>
        </Card>
      </section>

      {/* Comparison across business lines (horizontal bar). */}
      <Card>
        <CardHeader>
          <CardTitle>Tasks by business line</CardTitle>
        </CardHeader>
        <CardContent>
          <BarComparisonChart data={byLine} color="var(--secondary)" />
        </CardContent>
      </Card>

      {/* Focused table: team performance. */}
      <Card>
        <CardHeader>
          <CardTitle>Team performance</CardTitle>
          <CardDescription>Latest recorded evaluations</CardDescription>
        </CardHeader>
        <CardContent>
          {evals.length === 0 ? (
            <EmptyState
              title="No evaluations yet"
              description="Performance evaluations will appear here once recorded."
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="bg-card sticky left-0">
                      Employee
                    </TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead className="text-right">Score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {evals.slice(0, 8).map((e) => {
                    const score = e.overall_score ?? null;
                    return (
                      <TableRow key={e.id}>
                        <TableCell className="bg-card sticky left-0 font-medium">
                          {e.employee?.full_name ?? "—"}
                        </TableCell>
                        <TableCell className="text-fg-muted">
                          {e.period}
                        </TableCell>
                        <TableCell className="text-right">
                          <TokenPill
                            color={scoreColor(score)}
                            label={score === null ? "—" : String(score)}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
