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
import { KpiCard } from "@/components/ui/kpi-card";
import { TokenPill } from "@/components/ui/token-pill";
import { TaskTable } from "@/components/dashboard/task-table";
import { StatusDistributionChart } from "@/components/charts/status-distribution-chart";
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
        <KpiCard
          label="Pending approvals"
          value={stats.pendingApprovals}
          icon={ClipboardCheck}
        />
        <KpiCard
          label="Pending review"
          value={stats.pendingReview}
          icon={Eye}
          accent="var(--color-status-pending_review)"
        />
        <KpiCard label="Active tasks" value={stats.active} icon={ListTodo} />
        <KpiCard
          label="Overdue"
          value={stats.overdue}
          icon={AlertTriangle}
          accent="var(--color-danger)"
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
            <StatusDistributionChart data={dist} />
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
