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
import { StatusDistributionChart } from "@/components/charts/status-distribution-chart";
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
        className="grid grid-cols-2 gap-4 lg:grid-cols-4"
      >
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
            <StatusDistributionChart data={dist} />
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
