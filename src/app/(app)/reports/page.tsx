import { getReportData } from "@/lib/data/reports";
import { listBusinessLines } from "@/lib/data/business-lines";
import { getCurrentProfile, getCurrentPermissions } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { formatDate } from "@/lib/format";
import type { TaskStatus } from "@/lib/data/types";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
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
import { StatusDistributionChart } from "@/components/charts/status-distribution-chart";
import { BarComparisonChart } from "@/components/charts/bar-comparison-chart";
import { ReportFilters } from "@/components/reports/report-filters";
import {
  ExportCsvButton,
  type CsvRow,
} from "@/components/reports/export-csv-button";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const profile = await getCurrentProfile();
  const permissions = profile ? await getCurrentPermissions() : [];
  if (!profile || !can("reports.read", permissions)) {
    return (
      <>
        <PageHeader title="Reports" />
        <EmptyState
          title="Access restricted"
          description="You don't have permission to view reports."
        />
      </>
    );
  }

  const sp = await searchParams;
  const str = (v: string | string[] | undefined) =>
    typeof v === "string" && v ? v : undefined;

  const [{ tasks, summary }, businessLines] = await Promise.all([
    getReportData({
      from: str(sp.from),
      to: str(sp.to),
      business_line_id: str(sp.business_line),
      status: str(sp.status) as TaskStatus | undefined,
    }),
    listBusinessLines(),
  ]);

  // aggregates for charts
  const byStatus: Record<string, number> = {};
  const byLine: Record<string, number> = {};
  for (const t of tasks) {
    byStatus[t.status] = (byStatus[t.status] ?? 0) + 1;
    const name = t.business_line?.name ?? "Unassigned";
    byLine[name] = (byLine[name] ?? 0) + 1;
  }
  const dist = Object.entries(byStatus).map(([status, count]) => ({
    status,
    count,
  }));
  const lineData = Object.entries(byLine).map(([label, count]) => ({
    label,
    count,
  }));
  const completionData = [
    { label: "Completed", count: summary.completed },
    { label: "Delayed", count: summary.delayed },
  ];

  const csvRows: CsvRow[] = tasks.map((t) => ({
    task_no: t.task_no ?? "",
    title: t.title,
    status: t.status,
    priority: t.priority,
    assignee: t.assignee?.full_name ?? "",
    created: t.created_at?.slice(0, 10) ?? "",
    due: t.due_date ?? "",
    completed: t.completed_at?.slice(0, 10) ?? "",
  }));

  return (
    <>
      <PageHeader
        title="Reports"
        subtitle="Filter, analyse, and export"
        actions={<ExportCsvButton rows={csvRows} />}
      />

      <ReportFilters businessLines={businessLines} />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Tasks" value={summary.count} />
        <KpiCard
          label="Completed"
          value={summary.completed}
          accent="var(--color-status-completed)"
        />
        <KpiCard
          label="Delayed"
          value={summary.delayed}
          accent="var(--color-danger)"
        />
        <KpiCard
          label="Avg quality"
          value={summary.avgQuality ?? "—"}
          accent="var(--color-warning)"
        />
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>By status</CardTitle>
          </CardHeader>
          <CardContent>
            <StatusDistributionChart data={dist} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>By business line</CardTitle>
          </CardHeader>
          <CardContent>
            <BarComparisonChart data={lineData} color="var(--secondary)" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Completion vs delay</CardTitle>
          </CardHeader>
          <CardContent>
            <BarComparisonChart data={completionData} />
          </CardContent>
        </Card>
      </div>

      {tasks.length === 0 ? (
        <EmptyState
          title="No tasks match"
          description="Adjust the filters above."
        />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Task No</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Assignee</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Due</TableHead>
                <TableHead>Completed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-mono text-xs">
                    {t.task_no}
                  </TableCell>
                  <TableCell className="font-medium">{t.title}</TableCell>
                  <TableCell>
                    <StatusBadge status={t.status} />
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {t.assignee?.full_name ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {formatDate(t.created_at)}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {formatDate(t.due_date)}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {formatDate(t.completed_at)}
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
