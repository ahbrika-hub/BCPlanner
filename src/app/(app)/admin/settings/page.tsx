import { listSettings } from "@/lib/data/settings";
import { getCurrentProfile, getCurrentPermissions } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { SettingsForm } from "@/components/settings/settings-form";

export default async function SettingsPage() {
  const profile = await getCurrentProfile();
  const permissions = profile ? await getCurrentPermissions() : [];

  if (!profile || !can("settings.read", permissions)) {
    return (
      <>
        <PageHeader title="Settings" />
        <EmptyState
          title="Access restricted"
          description="You don't have permission to view settings."
        />
      </>
    );
  }

  const settings = await listSettings();

  return (
    <>
      <PageHeader title="Settings" subtitle="Application configuration" />
      {settings.length === 0 ? (
        <EmptyState
          title="No settings"
          description="No configuration keys found."
        />
      ) : (
        <SettingsForm
          settings={settings}
          canManage={can("settings.manage", permissions)}
        />
      )}
    </>
  );
}
