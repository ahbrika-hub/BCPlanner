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
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// Charts are the only Recharts consumers here — load them lazily (ssr:false) so
// Recharts is code-split out of the dashboard's initial bundle. KPI cards and
// tables keep rendering immediately; each chart fills in behind a skeleton sized
// to the chart so there's no layout shift. Output/series/colours are unchanged.
const StatusDistributionChart = dynamic(
  () =>
    import("@/components/charts/status-distribution-chart").then(
      (m) => m.StatusDistributionChart,
    ),
  {
    ssr: false,
    loading: () => (
      <Skeleton className="mx-auto aspect-square max-h-72 w-full rounded-md" />
    ),
  },
);
const BarComparisonChart = dynamic(
  () =>
    import("@/components/charts/bar-comparison-chart").then(
      (m) => m.BarComparisonChart,
    ),
  {
    ssr: false,
    loading: () => (
      <Skeleton className="aspect-video max-h-72 w-full rounded-md" />
    ),
  },
);
const TasksOverTimeChart = dynamic(
  () =>
    import("@/components/charts/tasks-over-time-chart").then(
      (m) => m.TasksOverTimeChart,
    ),
  {
    ssr: false,
    loading: () => (
      <Skeleton className="aspect-video max-h-64 w-full rounded-md" />
    ),
  },
);

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
