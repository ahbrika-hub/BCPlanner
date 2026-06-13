import Link from "next/link";

import { getDelayedReport } from "@/lib/data/delayed";
import { listBusinessLines } from "@/lib/data/business-lines";
import { listAssignableUsers } from "@/lib/data/profiles";
import { getCurrentProfile, getCurrentPermissions } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { formatDate } from "@/lib/format";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { KpiCard } from "@/components/charts/kpi-card";
import { BarComparisonChart } from "@/components/charts/bar-comparison-chart";
import { ReportFilters } from "@/components/reports/report-filters";
import {
  ExportCsvButton,
  type CsvRow,
} from "@/components/reports/export-csv-button";

// Live, permission-scoped data via cookies — render on demand.
export const dynamic = "force-dynamic";

export default async function DelayedReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const profile = await getCurrentProfile();
  const permissions = profile ? await getCurrentPermissions() : [];
  // Department-wide breakdown by employee — gated to the management set
  // (admin / section_head / ceo). Plain reports.read (employee) is excluded.
  if (!profile || !can("reports.read_all", permissions)) {
    return (
      <>
        <PageHeader title="Delayed tasks" />
        <EmptyState
          title="Access restricted"
          description="You don't have permission to view the delayed-tasks report."
        />
      </>
    );
  }

  const sp = await searchParams;
  const str = (v: string | string[] | undefined) =>
    typeof v === "string" && v ? v : undefined;
  const sel = (v: string | string[] | undefined) => {
    const s = str(v);
    return s && s !== "all" ? s : undefined;
  };

  const [report, businessLines, assignees] = await Promise.all([
    getDelayedReport({
      from: str(sp.from),
      to: str(sp.to),
      business_line_id: sel(sp.business_line),
      assignee_id: sel(sp.assignee),
    }),
    listBusinessLines(),
    listAssignableUsers(),
  ]);

  const csvRows: CsvRow[] = report.tasks.map((t) => ({
    task_no: t.task_no ?? "",
    title: t.title,
    status: t.status,
    priority: t.priority,
    assignee: t.assignee_name ?? "",
    business_line: t.business_line_name ?? "",
    due: t.due_date ?? "",
    delay_days: t.delay_days,
  }));

  return (
    <>
      <PageHeader
        title="Delayed tasks"
        subtitle="Open tasks past their due date, by employee, line, and priority"
        actions={
          <div className="flex items-center gap-2">
            <Button asChild size="sm" variant="ghost">
              <Link href="/reports">Back to reports</Link>
            </Button>
            <ExportCsvButton
              rows={csvRows}
              filename="tss-planner-delayed-tasks.csv"
            />
          </div>
        }
      />

      <ReportFilters businessLines={businessLines} assignees={assignees} />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Delayed"
          value={report.delayedCount}
          accent="var(--color-danger)"
        />
        <KpiCard
          label="On track"
          value={report.onTrackCount}
          accent="var(--color-status-completed)"
        />
        <KpiCard
          label="Avg delay (days)"
          value={report.avgDelayDays ?? "—"}
          accent="var(--color-warning)"
        />
        <KpiCard
          label="Max delay (days)"
          value={report.maxDelayDays}
          accent="var(--color-danger)"
        />
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Delayed by employee</CardTitle>
          </CardHeader>
          <CardContent>
            <BarComparisonChart
              data={report.byEmployee}
              color="var(--color-danger)"
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Delayed by business line</CardTitle>
          </CardHeader>
          <CardContent>
            <BarComparisonChart
              data={report.byBusinessLine}
              color="var(--secondary)"
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Delayed by priority</CardTitle>
          </CardHeader>
          <CardContent>
            <BarComparisonChart
              data={report.byPriority}
              color="var(--color-warning)"
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Delayed vs on track</CardTitle>
          </CardHeader>
          <CardContent>
            <BarComparisonChart data={report.completion} />
          </CardContent>
        </Card>
      </div>

      {report.tasks.length === 0 ? (
        <EmptyState
          title="Nothing delayed"
          description="No open tasks are past their due date for this filter."
        />
      ) : (
        <div className="rounded-lg border">
          <Table stickyFirstColumn>
            <TableHeader>
              <TableRow>
                <TableHead>Task No</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Assignee</TableHead>
                <TableHead>Business Line</TableHead>
                <TableHead>Due</TableHead>
                <TableHead className="text-right">Delay (days)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.tasks.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-mono text-xs">
                    <Link
                      href={`/tasks/${t.id}`}
                      className="hover:underline"
                    >
                      {t.task_no}
                    </Link>
                  </TableCell>
                  <TableCell className="font-medium">{t.title}</TableCell>
                  <TableCell>
                    <StatusBadge status={t.status} />
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {t.assignee_name ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {t.business_line_name ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {formatDate(t.due_date)}
                  </TableCell>
                  <TableCell className="text-danger text-right font-semibold tabular-nums">
                    {t.delay_days}
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