import Link from "next/link";
import {
  ListTodo,
  CheckCircle2,
  AlertTriangle,
  Star,
  ClipboardCheck,
  Eye,
} from "lucide-react";

import {
  getReviewPackData,
  REVIEW_PACK_PERMISSION,
} from "@/lib/data/review-pack";
import { getCurrentProfile, getCurrentPermissions } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { formatDate, formatDateTime } from "@/lib/format";
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
import { WorkloadTable } from "@/components/workload/workload-table";

// Live, permission-scoped composition of existing sources — render on demand.
export const dynamic = "force-dynamic";

function AsOf({ at }: { at: string }) {
  return (
    <p className="text-muted-foreground mb-3 text-xs">
      As of {formatDateTime(at)}
    </p>
  );
}

export default async function ManagementReviewPage() {
  const profile = await getCurrentProfile();
  const permissions = profile ? await getCurrentPermissions() : [];

  // Gated to ceo + section_head + admin via reports.read_all (employees excluded).
  if (!profile || !can(REVIEW_PACK_PERMISSION, permissions)) {
    return (
      <>
        <PageHeader title="Management review" />
        <EmptyState
          title="Access restricted"
          description="You don't have permission to view the management review pack."
        />
      </>
    );
  }

  const asOf = new Date().toISOString();
  const { stats, delayed, workload, workloadRange } =
    await getReviewPackData(asOf);

  return (
    <>
      <PageHeader
        title="Weekly management review"
        subtitle="Leadership snapshot — KPIs, delayed tasks, and workload, composed from the live sources"
      />

      {/* 1) Executive/operational KPIs — getDashboardStats() */}
      <section className="mb-8">
        <h2 className="mb-1 text-sm font-semibold">Key indicators</h2>
        <AsOf at={asOf} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <KpiCard label="Active tasks" value={stats.active} icon={ListTodo} />
          <KpiCard
            label="Completion rate"
            value={`${stats.completionRate}%`}
            icon={CheckCircle2}
            accent="var(--color-success)"
          />
          <KpiCard
            label="Overdue"
            value={stats.overdue}
            icon={AlertTriangle}
            accent="var(--color-danger)"
          />
          <KpiCard
            label="Pending approvals"
            value={stats.pendingApprovals}
            icon={ClipboardCheck}
            accent="var(--color-warning)"
          />
          <KpiCard
            label="Pending review"
            value={stats.pendingReview}
            icon={Eye}
            accent="var(--color-status-pending_review)"
          />
          <KpiCard
            label="Avg quality"
            value={stats.avgQuality ?? "—"}
            icon={Star}
            accent="var(--color-warning)"
            hint="out of 5"
          />
        </div>
      </section>

      {/* 2) Delayed-tasks breakdown — getDelayedReport() */}
      <section className="mb-8">
        <h2 className="mb-1 text-sm font-semibold">Delayed tasks</h2>
        <AsOf at={asOf} />
        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label="Delayed"
            value={delayed.delayedCount}
            accent="var(--color-danger)"
          />
          <KpiCard
            label="On track"
            value={delayed.onTrackCount}
            accent="var(--color-status-completed)"
          />
          <KpiCard
            label="Avg delay (days)"
            value={delayed.avgDelayDays ?? "—"}
            accent="var(--color-warning)"
          />
          <KpiCard
            label="Max delay (days)"
            value={delayed.maxDelayDays}
            accent="var(--color-danger)"
          />
        </div>
        {delayed.tasks.length === 0 ? (
          <EmptyState
            title="Nothing delayed"
            description="No open tasks are past their due date."
          />
        ) : (
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-sm">
                Most delayed ({Math.min(delayed.tasks.length, 10)} of{" "}
                {delayed.tasks.length})
              </CardTitle>
              <Link
                href="/reports/delayed"
                className="text-primary text-xs hover:underline"
              >
                Full report →
              </Link>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border">
                <Table stickyFirstColumn>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Task No</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Assignee</TableHead>
                      <TableHead>Due</TableHead>
                      <TableHead className="text-right">Delay (days)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {delayed.tasks.slice(0, 10).map((t) => (
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
            </CardContent>
          </Card>
        )}
      </section>

      {/* 3) Workload heatmap/bands — getWorkloadForRange() + WorkloadTable */}
      <section className="mb-4">
        <h2 className="mb-1 text-sm font-semibold">
          Workload · {workloadRange.from} → {workloadRange.to}
        </h2>
        <AsOf at={asOf} />
        {workload.length === 0 ? (
          <EmptyState
            title="No workload data"
            description="No active tasks overlap this week."
          />
        ) : (
          <WorkloadTable rows={workload} />
        )}
      </section>
    </>
  );
}
