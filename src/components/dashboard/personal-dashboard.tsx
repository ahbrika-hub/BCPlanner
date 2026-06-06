import Link from "next/link";
import { ListTodo, CheckCircle2, AlertTriangle, Gauge } from "lucide-react";

import { getDashboardStats } from "@/lib/data/analytics";
import { listTasks } from "@/lib/data/tasks";
import { listNotifications } from "@/lib/data/notifications";
import { computeEmployeeMetrics } from "@/lib/data/performance";
import { formatDateTime } from "@/lib/format";
import { currentPeriod } from "@/lib/performance/period";
import { KpiCard } from "@/components/charts/kpi-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

export async function PersonalDashboard({ userId }: { userId: string }) {
  const period = currentPeriod();
  const [stats, myTasks, notifications, metrics] = await Promise.all([
    getDashboardStats({ assigneeId: userId }),
    listTasks({
      assignee_id: userId,
      status: [
        "assigned",
        "in_progress",
        "returned_for_modification",
        "reopened",
      ],
    }),
    listNotifications(),
    computeEmployeeMetrics(userId, period),
  ]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
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
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
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
              <ul className="divide-y">
                {myTasks.map((t) => (
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
              <ul className="divide-y">
                {notifications.slice(0, 6).map((n) => (
                  <li key={n.id} className="py-2">
                    <p className="text-sm font-medium">{n.title}</p>
                    <p className="text-muted-foreground text-xs">
                      {formatDateTime(n.created_at)}
                    </p>
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
