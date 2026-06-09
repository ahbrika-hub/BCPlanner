import { listProjects } from "@/lib/data/projects";
import { listBusinessLines } from "@/lib/data/business-lines";
import { getCurrentProfile, getCurrentPermissions } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { ProjectsManager } from "@/components/projects/projects-manager";

export default async function ProjectsPage() {
  const profile = await getCurrentProfile();
  const permissions = profile ? await getCurrentPermissions() : [];

  if (!profile || !can("projects.manage", permissions)) {
    return (
      <>
        <PageHeader title="Projects" />
        <EmptyState
          title="Access restricted"
          description="You don't have permission to manage projects."
        />
      </>
    );
  }

  const [rows, businessLines] = await Promise.all([
    listProjects(),
    listBusinessLines(),
  ]);

  return (
    <>
      <PageHeader
        title="Projects"
        subtitle="Reference list for project-type tasks"
      />
      <ProjectsManager rows={rows} businessLines={businessLines} />
    </>
  );
}
