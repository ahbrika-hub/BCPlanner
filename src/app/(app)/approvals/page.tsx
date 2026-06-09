import Link from "next/link";

import { listTasks } from "@/lib/data/tasks";
import { getCurrentProfile, getCurrentPermissions } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { formatDate } from "@/lib/format";
import type { TaskWithRelations, UserRole } from "@/lib/data/types";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { TaskActionBar } from "@/components/tasks/task-action-bar";

function QueueItem({
  task,
  role,
  permissions,
}: {
  task: TaskWithRelations;
  role: UserRole;
  permissions: string[];
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Link
              href={`/tasks/${task.id}`}
              className="font-medium hover:underline"
            >
              {task.title}
            </Link>
            <StatusBadge status={task.status} />
          </div>
          <p className="text-muted-foreground mt-1 text-xs">
            {task.task_no} · {task.creator?.full_name ?? "—"} ·{" "}
            {task.assignee?.full_name
              ? `assignee ${task.assignee.full_name} · `
              : ""}
            {formatDate(task.created_at)}
          </p>
          {task.sharepoint_url && (
            <a
              href={task.sharepoint_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary mt-1 inline-block text-xs break-all hover:underline"
            >
              Open in SharePoint
            </a>
          )}
        </div>
        <TaskActionBar
          taskId={task.id}
          status={task.status}
          role={role}
          permissions={permissions}
          users={[]}
        />
      </CardContent>
    </Card>
  );
}

export default async function ApprovalsPage() {
  const profile = await getCurrentProfile();
  const permissions = profile ? await getCurrentPermissions() : [];

  if (!profile || !can("tasks.approve", permissions)) {
    return (
      <>
        <PageHeader title="Approvals" />
        <EmptyState
          title="Access restricted"
          description="You don't have permission to review approvals."
        />
      </>
    );
  }

  const [pendingApproval, pendingReview] = await Promise.all([
    listTasks({ status: ["pending_approval"] }),
    listTasks({ status: ["pending_review"] }),
  ]);

  return (
    <>
      <PageHeader title="Approvals" subtitle="Review and action tasks" />

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">
          Pending Approval ({pendingApproval.length})
        </h2>
        {pendingApproval.length === 0 ? (
          <EmptyState
            title="Nothing to approve"
            description="The queue is clear."
          />
        ) : (
          <div className="space-y-3">
            {pendingApproval.map((t) => (
              <QueueItem
                key={t.id}
                task={t}
                role={profile.role}
                permissions={permissions}
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">
          Pending Review ({pendingReview.length})
        </h2>
        {pendingReview.length === 0 ? (
          <EmptyState
            title="Nothing to review"
            description="The queue is clear."
          />
        ) : (
          <div className="space-y-3">
            {pendingReview.map((t) => (
              <QueueItem
                key={t.id}
                task={t}
                role={profile.role}
                permissions={permissions}
              />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
