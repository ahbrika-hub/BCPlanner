import { getCurrentProfile, getCurrentPermissions } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { getLatestSnapshot, getBusinessLineLogos } from "@/lib/data/dashboard";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { WeeklyDashboard } from "@/components/dashboard/weekly/weekly-dashboard";

// Always render the most recent snapshot (a new upload revalidates this route).
export const dynamic = "force-dynamic";

export default async function WeeklyDashboardPage() {
  const profile = await getCurrentProfile();
  const permissions = profile ? await getCurrentPermissions() : [];

  if (!profile || !can("dashboard.read", permissions)) {
    return (
      <>
        <PageHeader title="Weekly Dashboard" />
        <EmptyState
          title="Access restricted"
          description="You don't have permission to view the weekly dashboard."
        />
      </>
    );
  }

  const [snapshot, logos] = await Promise.all([
    getLatestSnapshot(),
    getBusinessLineLogos(),
  ]);

  if (!snapshot) {
    return (
      <>
        <PageHeader title="Weekly Dashboard" />
        <EmptyState
          title="No dashboard yet"
          description="Once this week's workbook is uploaded from the Dashboard Update task, it appears here."
        />
      </>
    );
  }

  return <WeeklyDashboard data={snapshot.data} logos={logos} />;
}
