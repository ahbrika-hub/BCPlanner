import { listTaskTemplates } from "@/lib/data/task-templates";
import { listBusinessLines } from "@/lib/data/business-lines";
import { getCurrentProfile, getCurrentPermissions } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { TemplatesManager } from "@/components/templates/templates-manager";

export default async function TemplatesPage() {
  const profile = await getCurrentProfile();
  const permissions = profile ? await getCurrentPermissions() : [];

  if (!profile || !can("templates.manage", permissions)) {
    return (
      <>
        <PageHeader title="Task templates" />
        <EmptyState
          title="Access restricted"
          description="You don't have permission to manage task templates."
        />
      </>
    );
  }

  const [rows, businessLines] = await Promise.all([
    listTaskTemplates(),
    listBusinessLines(),
  ]);

  return (
    <>
      <PageHeader
        title="Task templates"
        subtitle="Reusable defaults that pre-fill the new-task form"
      />
      <TemplatesManager rows={rows} businessLines={businessLines} />
    </>
  );
}
