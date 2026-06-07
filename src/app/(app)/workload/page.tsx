import { getWorkload } from "@/lib/data/workload";
import { getCurrentProfile, getCurrentPermissions } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Progress } from "@/components/ui/progress";
import { TokenPill } from "@/components/ui/token-pill";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// Workload level → semantic state token (shared TokenPill anatomy).
const levelColor: Record<string, string> = {
  high: "var(--color-danger)",
  medium: "var(--color-warning)",
  low: "var(--color-success)",
};
const levelLabel: Record<string, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

export default async function WorkloadPage() {
  const profile = await getCurrentProfile();
  const permissions = profile ? await getCurrentPermissions() : [];

  if (
    !profile ||
    (!can("workload.read", permissions) &&
      !can("workload.read_all", permissions))
  ) {
    return (
      <>
        <PageHeader title="Workload" />
        <EmptyState
          title="Access restricted"
          description="You don't have permission to view workload."
        />
      </>
    );
  }

  const rows = await getWorkload();

  return (
    <>
      <PageHeader title="Workload" subtitle="Active capacity and utilization" />

      {rows.length === 0 ? (
        <EmptyState
          title="No workload data"
          description="No active tasks to report."
        />
      ) : (
        <div className="rounded-lg border">
          <Table stickyFirstColumn>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Active Tasks</TableHead>
                <TableHead>Est. Hours</TableHead>
                <TableHead className="w-48">Utilization</TableHead>
                <TableHead>Level</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const util = Number(r.utilization_pct ?? 0);
                const level = r.workload_level ?? "low";
                return (
                  <TableRow key={r.employee_id ?? r.full_name}>
                    <TableCell className="font-medium">{r.full_name}</TableCell>
                    <TableCell>{r.active_task_count}</TableCell>
                    <TableCell>
                      {Number(r.total_estimated_hours ?? 0)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress
                          value={Math.min(util, 100)}
                          className="w-28"
                        />
                        <span className="text-muted-foreground text-xs">
                          {util}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <TokenPill
                        color={
                          levelColor[level] ?? "var(--color-muted-foreground)"
                        }
                        label={levelLabel[level] ?? level}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
