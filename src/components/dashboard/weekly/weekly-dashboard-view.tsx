import { getCurrentProfile, getCurrentPermissions } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { getLatestSnapshot, getBusinessLineLogos } from "@/lib/data/dashboard";
import { EmptyState } from "@/components/ui/empty-state";
import { WeeklyDashboard } from "@/components/dashboard/weekly/weekly-dashboard";

/**
 * Business Lines (weekly) view — gated on `dashboard.read`, renders the latest
 * snapshot via the existing {@link WeeklyDashboard} component (logo filter +
 * week/MTD/YTD toggle). Self-contained so it can be reused by both the unified
 * Dashboard tab (`/dashboard?view=business-lines`) and `/dashboard/weekly`.
 */
export async function WeeklyDashboardView() {
  const profile = await getCurrentProfile();
  const permissions = profile ? await getCurrentPermissions() : [];

  if (!profile || !can("dashboard.read", permissions)) {
    return (
      <EmptyState
        title="Access restricted"
        description="You don't have permission to view the weekly dashboard."
      />
    );
  }

  const [snapshot, logos] = await Promise.all([
    getLatestSnapshot(),
    getBusinessLineLogos(),
  ]);

  if (!snapshot) {
    return (
      <EmptyState
        title="Awaiting accepted data"
        description="The weekly dashboard updates once a Dashboard Update task is completed (accepted) by a section head or admin. Upload a workbook on that task, or load sample data."
      />
    );
  }

  return <WeeklyDashboard data={snapshot.data} logos={logos} />;
}
