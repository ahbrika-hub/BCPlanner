import Link from "next/link";
import { ClipboardCheck, Eye, ListTodo, AlertTriangle } from "lucide-react";

import {
  getDashboardStats,
  getStatusDistribution,
  getCompletionTrend,
  getOverdueTasks,
  getRecentActivity,
} from "@/lib/data/analytics";
import { getWorkload } from "@/lib/data/workload";
import { formatDate } from "@/lib/format";
import { KpiCard } from "@/components/charts/kpi-card";
import { StatusDistributionChart } from "@/components/charts/status-distribution-chart";
import { TasksOverTimeChart } from "@/components/charts/tasks-over-time-chart";
import { StatusBadge } from "@/components/ui/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";

export async function OperationalDashboard() {
  const [stats, dist, trend, overdue, recent, workload] = await Promise.all([
    getDashboardStats(),
    getStatusDistribution(),
    getCompletionTrend(3),
    getOverdueTasks(8),
    getRecentActivity(8),
    getWorkload(),
  ]);

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
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
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
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Approvals queue</CardTitle>
            <Button asChild size="sm" variant="outline">
              <Link href="/approvals">Open</Link>
            </Button>
          </CardHeader>
          <CardContent>
            <p className="text-sm">
              <span className="font-semibold">{stats.pendingApprovals}</span>{" "}
              awaiting approval ·{" "}
              <span className="font-semibold">{stats.pendingReview}</span>{" "}
              awaiting review
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Team workload</CardTitle>
          </CardHeader>
          <CardContent className="flex gap-6 text-sm">
            <span className="text-danger font-medium">High: {levels.high}</span>
            <span className="text-warning font-medium">
              Medium: {levels.medium}
            </span>
            <span className="text-success font-medium">Low: {levels.low}</span>
          </CardContent>
        </Card>
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
            <CardTitle>Completion trend</CardTitle>
          </CardHeader>
          <CardContent>
            <TasksOverTimeChart data={trend} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
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
              <ul className="divide-y">
                {overdue.map((t) => (
                  <li
                    key={t.id}
                    className="flex items-center justify-between gap-2 py-2"
                  >
                    <Link
                      href={`/tasks/${t.id}`}
                      className="truncate text-sm hover:underline"
                    >
                      {t.title}
                    </Link>
                    <span className="text-danger shrink-0 text-xs">
                      {formatDate(t.due_date)}
                    </span>
                  </li>
                ))}
              </ul>
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
              <ul className="divide-y">
                {recent.map((t) => (
                  <li
                    key={t.id}
                    className="flex items-center justify-between gap-2 py-2"
                  >
                    <Link
                      href={`/tasks/${t.id}`}
                      className="truncate text-sm hover:underline"
                    >
                      {t.title}
                    </Link>
                    <StatusBadge status={t.status} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
