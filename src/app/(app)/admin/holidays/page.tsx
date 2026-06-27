import { listHolidays } from "@/lib/data/holidays";
import { getCurrentProfile, getCurrentPermissions } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { HolidaysManager } from "@/components/holidays/holidays-manager";

export default async function HolidaysPage() {
  const profile = await getCurrentProfile();
  const permissions = profile ? await getCurrentPermissions() : [];

  if (!profile || !can("settings.manage", permissions)) {
    return (
      <>
        <PageHeader title="Public Holidays" />
        <EmptyState
          title="Access restricted"
          description="You don't have permission to manage public holidays."
        />
      </>
    );
  }

  const rows = await listHolidays();

  return (
    <>
      <PageHeader
        title="Public Holidays"
        subtitle="Capacity calendar — subtracted from working-day capacity. Eid dates are moon-sighting estimates; correct them once officially announced."
      />
      <HolidaysManager rows={rows} />
    </>
  );
}
