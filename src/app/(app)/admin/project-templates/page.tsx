import { listProjectTemplates } from "@/lib/data/project-templates";
import { listBusinessLines } from "@/lib/data/business-lines";
import { getCurrentProfile, getCurrentPermissions } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { ProjectTemplatesManager } from "@/components/project-templates/project-templates-manager";

export default async function ProjectTemplatesPage() {
  const profile = await getCurrentProfile();
  const permissions = profile ? await getCurrentPermissions() : [];

  if (!profile || !can("projects.manage", permissions)) {
    return (
      <>
        <PageHeader title="Project templates" />
        <EmptyState
          title="Access restricted"
          description="You don't have permission to manage project templates."
        />
      </>
    );
  }

  const [rows, businessLines] = await Promise.all([
    listProjectTemplates(),
    listBusinessLines(),
  ]);

  return (
    <>
      <PageHeader
        title="Project templates"
        subtitle="Reusable project recipes that auto-generate a standard task set"
      />
      <ProjectTemplatesManager rows={rows} businessLines={businessLines} />
    </>
  );
}
