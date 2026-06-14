import { listTasks } from "@/lib/data/tasks";
import { listBusinessLines } from "@/lib/data/business-lines";
import { listAssignableUsers } from "@/lib/data/profiles";
import { getCurrentProfile, getCurrentPermissions } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { bulkActionsFor } from "@/lib/tasks/transitions";
import type { TaskWithRelations, TaskStatus } from "@/lib/data/types";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import {
  BulkQueue,
  type QueueTask,
  type BulkActionDescriptor,
} from "@/components/tasks/bulk-queue";

function toQueueTask(t: TaskWithRelations): QueueTask {
  return {
    id: t.id,
    task_no: t.task_no,
    title: t.title,
    status: t.status,
    creator_name: t.creator?.full_name ?? null,
    creator_role: t.creator?.role ?? null,
    assignee_name: t.assignee?.full_name ?? null,
    created_at: t.created_at,
    sharepoint_url: t.sharepoint_url,
  };
}

function toBulkActions(status: TaskStatus, permissions: string[]): BulkActionDescriptor[] {
  return bulkActionsFor(status, permissions).map((a) => ({
    action: a.action,
    label: a.label,
    requires: a.requires,
    variant: a.variant,
  }));
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

  const [pendingApproval, pendingReview, businessLines, users] =
    await Promise.all([
      listTasks({ status: ["pending_approval"] }),
      listTasks({ status: ["pending_review"] }),
      listBusinessLines(),
      listAssignableUsers(),
    ]);

  const approveActions = toBulkActions("pending_approval", permissions);
  const reviewActions = toBulkActions("pending_review", permissions);

  return (
    <>
      <PageHeader
        title="Approvals"
        subtitle="Review and action tasks — select multiple to act in bulk"
      />

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
          <BulkQueue
            tasks={pendingApproval.map(toQueueTask)}
            actions={approveActions}
            role={profile.role}
            permissions={permissions}
            businessLines={businessLines}
            users={users}
          />
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
          <BulkQueue
            tasks={pendingReview.map(toQueueTask)}
            actions={reviewActions}
            role={profile.role}
            permissions={permissions}
          />
        )}
      </section>
    </>
  );
}
