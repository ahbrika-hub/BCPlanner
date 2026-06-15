import { notFound } from "next/navigation";

import { getProject } from "@/lib/data/projects";
import { getProjectHealth } from "@/lib/data/project-health";
import { getCurrentProfile, getCurrentPermissions } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { KpiCard } from "@/components/ui/kpi-card";
import { DrilldownKpi } from "@/components/dashboard/drilldown-kpi";

// Live, permission-scoped data via cookies — render on demand.
export const dynamic = "force-dynamic";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // Independent reads → fetch concurrently. permissions derives from auth.uid()
  // (not the profile row) and the helpers are React cache()'d, so eager-parallel
  // is safe; the auth guard below still gates the project reads.
  const [{ id }, profile, permissions] = await Promise.all([
    params,
    getCurrentProfile(),
    getCurrentPermissions(),
  ]);

  // Department-wide rollup → gated to those who can see all project tasks
  // (tasks.read_all = admin / section_head / ceo). Employees are excluded.
  if (!profile || !can("tasks.read_all", permissions)) {
    return (
      <>
        <PageHeader title="Project" />
        <EmptyState
          title="Access restricted"
          description="You don't have permission to view project health."
        />
      </>
    );
  }

  // Both reads are keyed only on `id` and independent of each other → run
  // concurrently. notFound() after the batch discards the (cheap) health rollup
  // in the rare case the project doesn't exist.
  const [project, health] = await Promise.all([
    getProject(id),
    getProjectHealth(id),
  ]);
  if (!project) notFound();

  return (
    <>
      <PageHeader
        title={project.name}
        subtitle="Project health"
        actions={
          <Badge variant={project.is_active ? "default" : "secondary"}>
            {project.is_active ? "Active" : "Inactive"}
          </Badge>
        }
      />

      {/* Clickable metrics drill into the underlying project tasks (reuses the
          dashboard DrilldownDialog, RLS-scoped). Avg quality has no task list,
          so it stays a plain card. No icon/function props cross to the client
          components, so the RSC boundary is safe. */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <DrilldownKpi
          label="Total tasks"
          value={health.total}
          drilldown={{ kind: "project-total", projectId: id }}
          title={`${project.name} — all tasks`}
          description="Every task in this project."
        />
        <DrilldownKpi
          label="Completed"
          value={health.completed}
          accent="var(--color-status-completed)"
          drilldown={{ kind: "project-status", projectId: id, status: "completed" }}
          title={`${project.name} — completed`}
          description="Completed tasks in this project."
        />
        <DrilldownKpi
          label="In progress"
          value={health.inProgress}
          drilldown={{ kind: "project-status", projectId: id, status: "in_progress" }}
          title={`${project.name} — in progress`}
          description="Tasks currently in progress."
        />
        <DrilldownKpi
          label="Pending review"
          value={health.pendingReview}
          accent="var(--color-status-pending_review)"
          drilldown={{ kind: "project-status", projectId: id, status: "pending_review" }}
          title={`${project.name} — pending review`}
          description="Tasks awaiting review."
        />
        <DrilldownKpi
          label="Overdue"
          value={health.overdue}
          accent="var(--color-danger)"
          drilldown={{ kind: "project-overdue", projectId: id }}
          title={`${project.name} — overdue`}
          description="Past due and not yet completed."
        />
        <KpiCard
          label="Avg quality"
          value={health.avgQuality ?? "—"}
          accent="var(--color-warning)"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Completion</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-semibold tracking-tight">
                {health.completionPct}%
              </span>
              <span className="text-muted-foreground text-xs">
                {health.completed} of {health.total} completed
              </span>
            </div>
            <Progress value={health.completionPct} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Average progress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-semibold tracking-tight">
                {health.avgProgress}%
              </span>
              <span className="text-muted-foreground text-xs">
                across {health.total} task{health.total === 1 ? "" : "s"}
              </span>
            </div>
            <Progress value={health.avgProgress} />
          </CardContent>
        </Card>
      </div>

      {health.total === 0 && (
        <div className="mt-6">
          <EmptyState
            title="No tasks yet"
            description="This project has no tasks to roll up."
          />
        </div>
      )}
    </>
  );
}
