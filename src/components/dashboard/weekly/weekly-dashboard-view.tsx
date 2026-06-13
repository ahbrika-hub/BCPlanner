import { getCurrentProfile, getCurrentPermissions } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import {
  getLatestSnapshot,
  getBusinessLineLogos,
  hasOpenDashboardUpdate,
} from "@/lib/data/dashboard";
import { listAssignableUsers } from "@/lib/data/profiles";
import { EmptyState } from "@/components/ui/empty-state";
import { WeeklyDashboard } from "@/components/dashboard/weekly/weekly-dashboard";
import { RequestUpdateButton } from "@/components/dashboard/weekly/request-update-button";

/**
 * Business Lines (weekly) view — gated on `dashboard.read`, renders the latest
 * LIVE snapshot (accepted Dashboard Update task, per the live-on-acceptance
 * flow). Reused by both the unified Dashboard tab (`/dashboard?view=business-lines`)
 * and `/dashboard/weekly`. admin/section_head/ceo also get a "Request update"
 * affordance.
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

  // The "Request update" affordance is for admin/section_head/ceo only; fetch
  // its supporting data only for them.
  const canRequest = can("dashboard.request_update", permissions);

  const [snapshot, logos, inProgress, users] = await Promise.all([
    getLatestSnapshot(),
    getBusinessLineLogos(),
    canRequest ? hasOpenDashboardUpdate() : Promise.resolve(false),
    canRequest ? listAssignableUsers() : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-4">
      {canRequest && (
        <div className="flex justify-end">
          <RequestUpdateButton
            canRequest={canRequest}
            inProgress={inProgress}
            users={users}
          />
        </div>
      )}
      {snapshot ? (
        <WeeklyDashboard data={snapshot.data} logos={logos} />
      ) : (
        // Preserve #54's live-on-acceptance empty state.
        <EmptyState
          title="Awaiting accepted data"
          description="The weekly dashboard updates once a Dashboard Update task is completed (accepted) by a section head or admin. Upload a workbook on that task, request an update above, or load sample data."
        />
      )}
    </div>
  );
}
