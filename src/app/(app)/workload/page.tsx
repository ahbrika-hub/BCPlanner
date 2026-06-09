import { getWorkload } from "@/lib/data/workload";
import { getCurrentProfile, getCurrentPermissions } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { WorkloadTable } from "@/components/workload/workload-table";

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
        <WorkloadTable rows={rows} />
      )}
    </>
  );
}
