import { getCurrentProfile, getCurrentPermissions } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { ExecutiveDashboard } from "@/components/dashboard/executive-dashboard";
import { OperationalDashboard } from "@/components/dashboard/operational-dashboard";
import { PersonalDashboard } from "@/components/dashboard/personal-dashboard";
import {
  DashboardViewTabs,
  type DashboardView,
} from "@/components/dashboard/dashboard-view-tabs";
import { WeeklyDashboardView } from "@/components/dashboard/weekly/weekly-dashboard-view";

// Both views read live data (profile/permissions via cookies; the weekly view
// reads the latest snapshot), so render on demand.
export const dynamic = "force-dynamic";

const subtitles: Record<string, string> = {
  ceo: "Executive overview",
  admin: "Operational overview",
  section_head: "Operational overview",
  employee: "Your work at a glance",
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const profile = await getCurrentProfile();
  if (!profile) {
    return (
      <>
        <PageHeader title="Dashboard" />
        <EmptyState
          title="No profile"
          description="Unable to load your profile."
        />
      </>
    );
  }

  const permissions = await getCurrentPermissions();
  const canReadWeekly = can("dashboard.read", permissions);

  // The Business Lines view is only reachable by viewers who can read it; any
  // other value (or lacking access) falls back to the Department view. Role
  // gating is unchanged — WeeklyDashboardView re-checks dashboard.read.
  const activeView: DashboardView =
    sp.view === "business-lines" && canReadWeekly
      ? "business-lines"
      : "department";

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle={
          activeView === "business-lines"
            ? "Business lines — weekly snapshot"
            : subtitles[profile.role]
        }
      />

      {canReadWeekly && <DashboardViewTabs active={activeView} />}

      {activeView === "business-lines" ? (
        <WeeklyDashboardView />
      ) : profile.role === "ceo" ? (
        <ExecutiveDashboard />
      ) : profile.role === "section_head" || profile.role === "admin" ? (
        <OperationalDashboard />
      ) : (
        <PersonalDashboard userId={profile.id} />
      )}
    </>
  );
}
