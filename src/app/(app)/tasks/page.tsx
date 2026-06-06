import Link from "next/link";

import { listTasks } from "@/lib/data/tasks";
import { listBusinessLines } from "@/lib/data/business-lines";
import { listAssignableUsers } from "@/lib/data/profiles";
import { getCurrentProfile, getCurrentPermissions } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { formatDate, priorityClasses, priorityLabels } from "@/lib/format";
import type { TaskStatus, TaskPriority } from "@/lib/data/types";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { Badge } from "@/components/ui/badge";
import { TaskFilters } from "@/components/tasks/task-filters";
import { NewTaskDialog } from "@/components/tasks/new-task-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const status =
    typeof sp.status === "string" ? [sp.status as TaskStatus] : undefined;
  const priority =
    typeof sp.priority === "string" ? (sp.priority as TaskPriority) : undefined;
  const search = typeof sp.q === "string" ? sp.q : undefined;

  const [tasks, businessLines, users, profile] = await Promise.all([
    listTasks({ status, priority, search }),
    listBusinessLines(),
    listAssignableUsers(),
    getCurrentProfile(),
  ]);
  const permissions = profile ? await getCurrentPermissions() : [];

  return (
    <>
      <PageHeader
        title="Tasks"
        subtitle="Create, track, and manage tasks"
        actions={
          can("tasks.create", permissions) ? (
            <NewTaskDialog businessLines={businessLines} users={users} />
          ) : null
        }
      />

      <TaskFilters />

      {tasks.length === 0 ? (
        <EmptyState
          title="No tasks found"
          description="Try adjusting your filters, or create a new task."
        />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Task No</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Assignee</TableHead>
                <TableHead>Due</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-mono text-xs">
                    <Link href={`/tasks/${t.id}`} className="hover:underline">
                      {t.task_no ?? "—"}
                    </Link>
                  </TableCell>
                  <TableCell className="font-medium">
                    <Link href={`/tasks/${t.id}`} className="hover:underline">
                      {t.title}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={t.status} />
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={priorityClasses[t.priority]}
                    >
                      {priorityLabels[t.priority]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {t.assignee?.full_name ?? "Unassigned"}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {formatDate(t.due_date)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
