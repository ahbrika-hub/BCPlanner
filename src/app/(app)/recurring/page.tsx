import {
  listRecurringTasks,
  listDeletedRecurringTasks,
} from "@/lib/data/recurring";
import { listBusinessLines } from "@/lib/data/business-lines";
import { listAssignableUsers } from "@/lib/data/profiles";
import { getCurrentProfile, getCurrentPermissions } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { RecurringManager } from "@/components/recurring/recurring-manager";

export default async function RecurringPage() {
  const profile = await getCurrentProfile();
  const permissions = profile ? await getCurrentPermissions() : [];

  if (!profile || !can("recurring.manage", permissions)) {
    return (
      <>
        <PageHeader title="Recurring Tasks" />
        <EmptyState
          title="Access restricted"
          description="You don't have permission to manage recurring tasks."
        />
      </>
    );
  }

  const [rows, deletedRows, businessLines, users] = await Promise.all([
    listRecurringTasks(),
    listDeletedRecurringTasks(),
    listBusinessLines(),
    listAssignableUsers(),
  ]);

  return (
    <>
      <PageHeader
        title="Recurring Tasks"
        subtitle="Templates that generate tasks on a schedule"
      />
      <p className="text-muted-foreground mb-4 text-xs">
        Tasks generate when you click “Generate Due Tasks Now”. Automatic daily
        generation (pg_cron / a Vercel Cron route) is planned for Phase 7.
      </p>
      <RecurringManager
        rows={rows}
        deletedRows={deletedRows}
        businessLines={businessLines}
        users={users}
      />
    </>
  );
}
