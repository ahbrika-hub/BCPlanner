import { listAuditLogs } from "@/lib/data/audit";
import { getCurrentProfile, getCurrentPermissions } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { AuditView } from "@/components/audit/audit-view";

const PAGE_SIZE = 25;

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const profile = await getCurrentProfile();
  const permissions = profile ? await getCurrentPermissions() : [];

  if (!profile || !can("audit.read", permissions)) {
    return (
      <>
        <PageHeader title="Audit Log" />
        <EmptyState
          title="Access restricted"
          description="You don't have permission to view the audit log."
        />
      </>
    );
  }

  const sp = await searchParams;
  const str = (v: string | string[] | undefined) =>
    typeof v === "string" && v ? v : undefined;
  const page = Math.max(1, Number(str(sp.page) ?? "1") || 1);

  const { rows, total } = await listAuditLogs(
    {
      entity_type: str(sp.entity_type),
      action: str(sp.action),
      from: str(sp.from),
      to: str(sp.to),
    },
    PAGE_SIZE,
    (page - 1) * PAGE_SIZE,
  );

  return (
    <>
      <PageHeader title="Audit Log" subtitle="System activity (read-only)" />
      <AuditView rows={rows} total={total} page={page} pageSize={PAGE_SIZE} />
    </>
  );
}
