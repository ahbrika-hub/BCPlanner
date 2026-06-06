import { listUsers } from "@/lib/data/users";
import { listDepartments } from "@/lib/data/departments";
import { getCurrentProfile, getCurrentPermissions } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { UsersManager } from "@/components/users/users-manager";

export default async function UsersPage() {
  const profile = await getCurrentProfile();
  const permissions = profile ? await getCurrentPermissions() : [];

  if (!profile || !can("users.read", permissions)) {
    return (
      <>
        <PageHeader title="User Management" />
        <EmptyState
          title="Access restricted"
          description="You don't have permission to view users."
        />
      </>
    );
  }

  const [users, departments] = await Promise.all([
    listUsers(),
    listDepartments(),
  ]);

  return (
    <>
      <PageHeader
        title="User Management"
        subtitle="Roles, departments, and access"
      />
      <UsersManager
        users={users}
        departments={departments}
        canManage={can("users.manage", permissions)}
        canInvite={can("users.invite", permissions)}
        currentUserId={profile.id}
      />
    </>
  );
}
