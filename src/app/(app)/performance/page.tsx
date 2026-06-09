import {
  computeEmployeeMetrics,
  listEvaluations,
  listEvaluableEmployees,
} from "@/lib/data/performance";
import { getCurrentProfile, getCurrentPermissions } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { currentPeriod, recentPeriods } from "@/lib/performance/period";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScoreBreakdown } from "@/components/performance/score-breakdown";
import { EvaluationForm } from "@/components/performance/evaluation-form";
import { EvaluationRowActions } from "@/components/performance/evaluation-row-actions";

export default async function PerformancePage() {
  const profile = await getCurrentProfile();
  const permissions = profile ? await getCurrentPermissions() : [];

  if (
    !profile ||
    (!can("performance.read", permissions) &&
      !can("performance.read_all", permissions))
  ) {
    return (
      <>
        <PageHeader title="Performance" />
        <EmptyState
          title="Access restricted"
          description="You don't have permission to view performance."
        />
      </>
    );
  }

  const isManager = can("performance.read_all", permissions);
  const canEvaluate = can("performance.evaluate", permissions);

  if (!isManager) {
    // Personal view
    const period = currentPeriod();
    const [metrics, history] = await Promise.all([
      computeEmployeeMetrics(profile.id, period),
      listEvaluations(profile.id),
    ]);

    return (
      <>
        <PageHeader
          title="My Performance"
          subtitle={`Current period · ${period}`}
        />
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Score breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <ScoreBreakdown
              assigned={metrics.assigned_tasks_count}
              completed={metrics.completed_tasks_count}
              delayed={metrics.delayed_tasks_count}
              quality={metrics.quality_avg_rating}
              overall={metrics.overall_score}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Evaluation history</CardTitle>
          </CardHeader>
          <CardContent>
            {history.length === 0 ? (
              <EmptyState
                title="No evaluations yet"
                description="Your evaluations will appear here."
              />
            ) : (
              <Table stickyFirstColumn>
                <TableHeader>
                  <TableRow>
                    <TableHead>Period</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Completed</TableHead>
                    <TableHead>Delayed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell>{e.period}</TableCell>
                      <TableCell className="font-semibold">
                        {e.overall_score ?? "—"}
                      </TableCell>
                      <TableCell>{e.completed_tasks_count}</TableCell>
                      <TableCell>{e.delayed_tasks_count}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </>
    );
  }

  // Manager / admin team view
  const [evaluations, employees] = await Promise.all([
    listEvaluations(),
    canEvaluate ? listEvaluableEmployees() : Promise.resolve([]),
  ]);

  return (
    <>
      <PageHeader
        title="Team Performance"
        subtitle="Evaluations and scores"
        actions={
          canEvaluate ? (
            <EvaluationForm employees={employees} periods={recentPeriods(8)} />
          ) : null
        }
      />

      {evaluations.length === 0 ? (
        <EmptyState
          title="No evaluations yet"
          description={
            canEvaluate
              ? "Create the first evaluation to get started."
              : "No evaluations recorded."
          }
        />
      ) : (
        <div className="rounded-lg border">
          <Table stickyFirstColumn>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Assigned</TableHead>
                <TableHead>Completed</TableHead>
                <TableHead>Delayed</TableHead>
                <TableHead>Quality</TableHead>
                {canEvaluate && (
                  <TableHead className="text-right">Actions</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {evaluations.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium">
                    {e.employee?.full_name ?? "—"}
                  </TableCell>
                  <TableCell>{e.period}</TableCell>
                  <TableCell className="font-semibold">
                    {e.overall_score ?? "—"}
                  </TableCell>
                  <TableCell>{e.assigned_tasks_count}</TableCell>
                  <TableCell>{e.completed_tasks_count}</TableCell>
                  <TableCell>{e.delayed_tasks_count}</TableCell>
                  <TableCell>{e.quality_avg_rating ?? "—"}</TableCell>
                  {canEvaluate && (
                    <TableCell className="text-right">
                      <EvaluationRowActions
                        id={e.id}
                        employeeName={e.employee?.full_name ?? "this employee"}
                        period={e.period}
                      />
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
