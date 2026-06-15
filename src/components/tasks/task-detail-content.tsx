import Link from "next/link";
import { notFound } from "next/navigation";

import { getTask } from "@/lib/data/tasks";
import { listUpdates } from "@/lib/data/task-updates";
import { pickLatestUpdate } from "@/lib/tasks/last-update";
import { listComments } from "@/lib/data/comments";
import { listAttachments } from "@/lib/data/attachments";
import { getTaskTimeline } from "@/lib/data/timeline";
import { listAssignableUsers } from "@/lib/data/profiles";
import { listBusinessLines } from "@/lib/data/business-lines";
import { listActiveProjects } from "@/lib/data/projects";
import { getCurrentProfile, getCurrentPermissions } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import {
  formatDate,
  formatDateTime,
  priorityClasses,
  priorityLabels,
} from "@/lib/format";
import { PageHeader } from "@/components/layout/page-header";
import { DASHBOARD_UPLOAD_CATEGORY } from "@/lib/dashboard/constants";
import { WeeklyDashboardUpload } from "@/components/dashboard/weekly-upload";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { StatusBadge } from "@/components/ui/status-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TaskActionBar } from "@/components/tasks/task-action-bar";
import { TaskTimeline } from "@/components/tasks/task-timeline";
import { EditTaskDialogLazy } from "@/components/tasks/edit-task-dialog-lazy";
import { CommentsSection } from "@/components/tasks/comments-section";
import { AttachmentsSection } from "@/components/tasks/attachments-section";

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="text-sm">{value ?? "—"}</dd>
    </div>
  );
}

/**
 * Server-side task detail — the single source of the task-detail fetch + render.
 * Rendered both by the full-page route (`/tasks/[id]`) and by the intercepted
 * modal slot (`@modal/(.)tasks/[id]`), so there is no duplicated query logic.
 */
export async function TaskDetailContent({ id }: { id: string }) {
  const task = await getTask(id);
  if (!task) notFound();

  const [
    updates,
    comments,
    attachments,
    users,
    businessLines,
    projects,
    timeline,
    profile,
  ] = await Promise.all([
    listUpdates(id),
    listComments(id),
    listAttachments(id),
    listAssignableUsers(),
    listBusinessLines(),
    listActiveProjects(),
    getTaskTimeline(id),
    getCurrentProfile(),
  ]);
  if (!profile) notFound();
  const permissions = await getCurrentPermissions();

  // Mirrors updateTaskAction + the tasks_update RLS policy: creator, current
  // assignee, or a manager (tasks.read_all), gated by tasks.update. The action
  // re-checks this server-side, so the affordance is a convenience only.
  const canEdit =
    can("tasks.update", permissions) &&
    (task.created_by === profile.id ||
      task.assignee_id === profile.id ||
      can("tasks.read_all", permissions));

  return (
    <>
      <PageHeader
        title={task.title}
        subtitle={task.task_no ?? undefined}
        breadcrumb={
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link href="/tasks">Tasks</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{task.task_no ?? "Task"}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {canEdit && (
              <EditTaskDialogLazy
                task={{
                  id: task.id,
                  title: task.title,
                  description: task.description,
                  priority: task.priority,
                  due_date: task.due_date,
                  business_line_id: task.business_line_id,
                  sharepoint_url: task.sharepoint_url,
                  task_category:
                    task.task_category === "project" ? "project" : "department",
                  project_id: task.project_id,
                }}
                businessLines={businessLines}
                projects={projects}
              />
            )}
            <TaskActionBar
              taskId={task.id}
              status={task.status}
              role={profile.role}
              permissions={permissions}
              users={users}
              lastUpdate={pickLatestUpdate(updates)}
              currentProgress={task.progress_percentage}
            />
          </div>
        }
      />

      {task.category === DASHBOARD_UPLOAD_CATEGORY &&
        task.assignee_id === profile.id && (
          <WeeklyDashboardUpload taskId={task.id} />
        )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <StatusBadge status={task.status} />
        <Badge variant="outline" className={priorityClasses[task.priority]}>
          {priorityLabels[task.priority]} priority
        </Badge>
      </div>

      <Card className="mb-6">
        <CardContent className="space-y-4 pt-6">
          {task.description && (
            <p className="text-sm whitespace-pre-wrap">{task.description}</p>
          )}
          <div>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Progress</span>
              <span>{task.progress_percentage}%</span>
            </div>
            <Progress value={task.progress_percentage} />
          </div>
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Field label="Category" value={task.category} />
            <Field
              label="Type"
              value={task.task_category === "project" ? "Project" : "Department"}
            />
            {task.task_category === "project" && (
              <Field
                label="Project"
                value={
                  task.project &&
                  can("tasks.read_all", permissions) ? (
                    <Link
                      href={`/projects/${task.project.id}`}
                      className="text-primary hover:underline"
                    >
                      {task.project.name}
                    </Link>
                  ) : (
                    task.project?.name
                  )
                }
              />
            )}
            <Field label="Business Line" value={task.business_line?.name} />
            <Field
              label="Assignee"
              value={task.assignee?.full_name ?? "Unassigned"}
            />
            <Field label="Created by" value={task.creator?.full_name} />
            <Field label="Approved by" value={task.approver?.full_name} />
            <Field label="Start" value={formatDate(task.start_date)} />
            <Field label="Due" value={formatDate(task.due_date)} />
            <Field
              label="Est. hours"
              value={task.estimated_effort_hours ?? "—"}
            />
            <Field label="Completed" value={formatDate(task.completed_at)} />
            {task.sharepoint_url && (
              <Field
                label="SharePoint"
                value={
                  <a
                    href={task.sharepoint_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary break-all hover:underline"
                  >
                    Open in SharePoint
                  </a>
                }
              />
            )}
          </dl>
          {task.closure_summary && (
            <div className="border-t pt-3">
              <Field
                label={`Closure summary${task.quality_rating ? ` (rated ${task.quality_rating}/5)` : ""}`}
                value={task.closure_summary}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="activity">
        <TabsList>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="updates">Updates ({updates.length})</TabsTrigger>
          <TabsTrigger value="comments">
            Comments ({comments.length})
          </TabsTrigger>
          <TabsTrigger value="attachments">
            Attachments ({attachments.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="activity" className="pt-4">
          <TaskTimeline
            taskId={task.id}
            initialEntries={timeline.entries}
            initialCursor={timeline.nextCursor}
          />
        </TabsContent>

        <TabsContent value="updates" className="pt-4">
          {updates.length === 0 ? (
            <p className="text-muted-foreground text-sm">No updates yet.</p>
          ) : (
            <ol className="space-y-3">
              {updates.map((u) => (
                <li key={u.id} className="rounded-md border p-3">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-sm font-medium">
                      {u.updater?.full_name ?? "—"}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {formatDateTime(u.created_at)} · {u.progress_percentage}%
                    </span>
                  </div>
                  {u.status_update_comment && (
                    <p className="text-sm">{u.status_update_comment}</p>
                  )}
                  {u.next_action && (
                    <p className="text-muted-foreground mt-1 text-xs">
                      Next: {u.next_action}
                    </p>
                  )}
                  {u.challenges_blockers && (
                    <p className="text-warning mt-1 text-xs">
                      Blockers: {u.challenges_blockers}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          )}
        </TabsContent>

        <TabsContent value="comments" className="pt-4">
          <CommentsSection
            taskId={task.id}
            comments={comments}
            role={profile.role}
            permissions={permissions}
          />
        </TabsContent>

        <TabsContent value="attachments" className="pt-4">
          <AttachmentsSection
            taskId={task.id}
            attachments={attachments}
            currentUserId={profile.id}
            permissions={permissions}
          />
        </TabsContent>
      </Tabs>
    </>
  );
}
