import { getDashboardStats } from "@/lib/data/analytics";
import { listTasks } from "@/lib/data/tasks";
import { listNotifications } from "@/lib/data/notifications";
import { computeEmployeeMetrics } from "@/lib/data/performance";
import { currentPeriod } from "@/lib/performance/period";
import { PersonalDashboardView } from "@/components/dashboard/personal-dashboard-view";

// Container: same queries as before the recompose; hands data to the view.
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
    <PersonalDashboardView
      period={period}
      stats={stats}
      myTasks={myTasks}
      notifications={notifications}
      metrics={metrics}
    />
  );
}
