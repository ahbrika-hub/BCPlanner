// Client component: it renders interactive drill-downs (DrilldownKpi,
// StatusDistributionDrilldown) and passes Lucide icon components to them, so the
// whole view must live on the client — a Server Component cannot pass a function
// (the icon) across the RSC boundary to a Client Component. Data still arrives
// as serializable props from the async server container.
"use client";

import Link from "next/link";
import { ClipboardCheck, Eye, ListTodo, AlertTriangle } from "lucide-react";

import type {
  getDashboardStats,
  getStatusDistribution,
  getCompletionTrend,
  getOverdueTasks,
  getRecentActivity,
} from "@/lib/data/analytics";
import type { getWorkload } from "@/lib/data/workload";
import { TokenPill } from "@/components/ui/token-pill";
import { TaskTable } from "@/components/dashboard/task-table";
import { DrilldownKpi } from "@/components/dashboard/drilldown-kpi";
import { StatusDistributionDrilldown } from "@/components/dashboard/status-distribution-drilldown";
import { TasksOverTimeChart } from "@/components/charts/tasks-over-time-chart";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";

export type OperationalDashboardData = {
  stats: Awaited<ReturnType<typeof getDashboardStats>>;
  dist: Awaited<ReturnType<typeof getStatusDistribution>>;
  trend: Awaited<ReturnType<typeof getCompletionTrend>>;
  overdue: Awaited<ReturnType<typeof getOverdueTasks>>;
  recent: Awaited<ReturnType<typeof getRecentActivity>>;
  workload: Awaited<ReturnType<typeof getWorkload>>;
};

const workloadTone = {
  high: "var(--color-danger)",
  medium: "var(--color-warning)",
  low: "var(--color-success)",
} as const;

export function OperationalDashboardView({
  stats,
  dist,
  trend,
  overdue,
  recent,
  workload,
}: OperationalDashboardData) {
  const levels = workload.reduce(
    (acc, w) => {
      const l = (w.workload_level ?? "low") as "high" | "medium" | "low";
      acc[l] = (acc[l] ?? 0) + 1;
      return acc;
    },
    { high: 0, medium: 0, low: 0 } as Record<string, number>,
  );

  return (
    <div className="space-y-6">
      <section
        aria-label="Key metrics"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <DrilldownKpi
          label="Pending approvals"
          value={stats.pendingApprovals}
          icon={ClipboardCheck}
          drilldown={{ kind: "status", status: "pending_approval" }}
          title="Pending approval"
          description="Tasks awaiting approval."
          viewAllHref="/tasks?status=pending_approval"
        />
        <DrilldownKpi
          label="Pending review"
          value={stats.pendingReview}
          icon={Eye}
          accent="var(--color-status-pending_review)"
          drilldown={{ kind: "status", status: "pending_review" }}
          title="Pending review"
          description="Tasks awaiting review."
          viewAllHref="/tasks?status=pending_review"
        />
        <DrilldownKpi
          label="Active tasks"
          value={stats.active}
          icon={ListTodo}
          drilldown={{ kind: "active" }}
          title="Active tasks"
          description="Tasks currently in flight."
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
      </section>

      <section aria-label="Queues" className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Approvals queue</CardTitle>
            <CardAction>
              <Button asChild size="sm" variant="outline">
                <Link href="/approvals">Open</Link>
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            <p className="text-sm">
              <span className="font-semibold tabular-nums">
                {stats.pendingApprovals}
              </span>{" "}
              awaiting approval ·{" "}
              <span className="font-semibold tabular-nums">
                {stats.pendingReview}
              </span>{" "}
              awaiting review
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Team workload</CardTitle>
            <CardAction>
              <Button asChild size="sm" variant="outline">
                <Link href="/workload">Open</Link>
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <TokenPill
              color={workloadTone.high}
              label={`High · ${levels.high}`}
            />
            <TokenPill
              color={workloadTone.medium}
              label={`Medium · ${levels.medium}`}
            />
            <TokenPill color={workloadTone.low} label={`Low · ${levels.low}`} />
          </CardContent>
        </Card>
      </section>

      <section aria-label="Charts" className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Status distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <StatusDistributionDrilldown data={dist} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Completion trend</CardTitle>
          </CardHeader>
          <CardContent>
            <TasksOverTimeChart data={trend} />
          </CardContent>
        </Card>
      </section>

      <section aria-label="Task lists" className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Overdue tasks</CardTitle>
          </CardHeader>
          <CardContent>
            {overdue.length === 0 ? (
              <EmptyState
                title="Nothing overdue"
                description="Great — the team is on track."
              />
            ) : (
              <TaskTable rows={overdue} showDue dueTone="danger" />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
          </CardHeader>
          <CardContent>
            {recent.length === 0 ? (
              <EmptyState
                title="No activity"
                description="Nothing recent to show."
              />
            ) : (
              <TaskTable rows={recent} />
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
