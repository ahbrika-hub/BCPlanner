import { ListTodo, CheckCircle2, AlertTriangle, Gauge } from "lucide-react";

import type { getDashboardStats } from "@/lib/data/analytics";
import type { listTasks } from "@/lib/data/tasks";
import type { listNotifications } from "@/lib/data/notifications";
import type { computeEmployeeMetrics } from "@/lib/data/performance";
import { formatDateTime } from "@/lib/format";
import { KpiCard } from "@/components/ui/kpi-card";
import { TaskTable } from "@/components/dashboard/task-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

export type PersonalDashboardData = {
  period: string;
  stats: Awaited<ReturnType<typeof getDashboardStats>>;
  myTasks: Awaited<ReturnType<typeof listTasks>>;
  notifications: Awaited<ReturnType<typeof listNotifications>>;
  metrics: Awaited<ReturnType<typeof computeEmployeeMetrics>>;
};

export function PersonalDashboardView({
  period,
  stats,
  myTasks,
  notifications,
  metrics,
}: PersonalDashboardData) {
  return (
    <div className="space-y-6">
      <section
        aria-label="My metrics"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <KpiCard label="My active tasks" value={stats.active} icon={ListTodo} />
        <KpiCard
          label="Completed"
          value={stats.completed}
          icon={CheckCircle2}
          accent="var(--color-status-completed)"
        />
        <KpiCard
          label="My overdue"
          value={stats.overdue}
          icon={AlertTriangle}
          accent="var(--color-danger)"
        />
        <KpiCard
          label={`Score (${period})`}
          value={metrics.overall_score}
          icon={Gauge}
          accent="var(--primary)"
        />
      </section>

      <section aria-label="My work" className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Needs my action</CardTitle>
          </CardHeader>
          <CardContent>
            {myTasks.length === 0 ? (
              <EmptyState
                title="All clear"
                description="No tasks need your attention."
              />
            ) : (
              <TaskTable rows={myTasks} />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Recent notifications</CardTitle>
          </CardHeader>
          <CardContent>
            {notifications.length === 0 ? (
              <EmptyState
                title="No notifications"
                description="You're all caught up."
              />
            ) : (
              <ul className="divide-border divide-y">
                {notifications.slice(0, 6).map((n) => (
                  <li key={n.id} className="py-2 first:pt-0 last:pb-0">
                    <p className="text-sm font-medium">{n.title}</p>
                    <p className="text-fg-muted text-xs">
                      {formatDateTime(n.created_at)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
