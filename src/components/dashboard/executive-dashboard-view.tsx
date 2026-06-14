// The executive (CEO) view is a READ-ONLY overview: no drill-downs into
// individual task lists/details (KPI cards and the status chart are not
// interactive for the CEO) and no team-performance table. It can stay a server
// component since it no longer passes click handlers across the RSC boundary —
// but it still receives icon components, so keep it on the client.
"use client";

import { ListTodo, CheckCircle2, AlertTriangle, Star } from "lucide-react";

import type {
  getDashboardStats,
  getStatusDistribution,
  getTasksByBusinessLine,
  getCompletionTrend,
} from "@/lib/data/analytics";
import { KpiCard } from "@/components/ui/kpi-card";
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

export type ExecutiveDashboardData = {
  stats: Awaited<ReturnType<typeof getDashboardStats>>;
  dist: Awaited<ReturnType<typeof getStatusDistribution>>;
  byLine: Awaited<ReturnType<typeof getTasksByBusinessLine>>;
  trend: Awaited<ReturnType<typeof getCompletionTrend>>;
};

export function ExecutiveDashboardView({
  stats,
  dist,
  byLine,
  trend,
}: ExecutiveDashboardData) {
  return (
    // Comfortable executive reading column on wide screens.
    <div className="mx-auto max-w-5xl space-y-8">
      {/* Lead: headline metrics (F-pattern top row). Read-only — no drill-down. */}
      <section
        aria-label="Key metrics"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
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

      {/* Composition + trend, side by side. The status chart is not clickable. */}
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
    </div>
  );
}
