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
import { KpiCard } from "@/components/charts/kpi-card";

// Live, permission-scoped data via cookies — render on demand.
export const dynamic = "force-dynamic";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  const permissions = profile ? await getCurrentPermissions() : [];

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

  const project = await getProject(id);
  if (!project) notFound();

  const health = await getProjectHealth(id);

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

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <KpiCard label="Total tasks" value={health.total} />
        <KpiCard
          label="Completed"
          value={health.completed}
          accent="var(--color-status-completed)"
        />
        <KpiCard label="In progress" value={health.inProgress} />
        <KpiCard
          label="Pending review"
          value={health.pendingReview}
          accent="var(--color-status-pending_review)"
        />
        <KpiCard
          label="Overdue"
          value={health.overdue}
          accent="var(--color-danger)"
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
