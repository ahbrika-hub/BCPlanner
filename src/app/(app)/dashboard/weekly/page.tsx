import { WeeklyDashboardView } from "@/components/dashboard/weekly/weekly-dashboard-view";

// Kept as a direct route (and URL fallback) for the Business Lines view; the
// gating + latest-snapshot read live in the reused WeeklyDashboardView.
export const dynamic = "force-dynamic";

export default function WeeklyDashboardPage() {
  return <WeeklyDashboardView />;
}
