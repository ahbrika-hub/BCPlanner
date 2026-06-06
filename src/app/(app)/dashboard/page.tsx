import { getCurrentProfile } from "@/lib/auth/session";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { ExecutiveDashboard } from "@/components/dashboard/executive-dashboard";
import { OperationalDashboard } from "@/components/dashboard/operational-dashboard";
import { PersonalDashboard } from "@/components/dashboard/personal-dashboard";

const subtitles: Record<string, string> = {
  ceo: "Executive overview",
  admin: "Operational overview",
  section_head: "Operational overview",
  employee: "Your work at a glance",
};

export default async function DashboardPage() {
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

  return (
    <>
      <PageHeader title="Dashboard" subtitle={subtitles[profile.role]} />
      {profile.role === "ceo" ? (
        <ExecutiveDashboard />
      ) : profile.role === "section_head" || profile.role === "admin" ? (
        <OperationalDashboard />
      ) : (
        <PersonalDashboard userId={profile.id} />
      )}
    </>
  );
}
