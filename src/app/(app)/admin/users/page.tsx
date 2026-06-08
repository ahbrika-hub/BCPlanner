import { listUsers, listPendingSignups } from "@/lib/data/users";
import { listDepartments } from "@/lib/data/departments";
import { getCurrentProfile, getCurrentPermissions } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { UsersManager } from "@/components/users/users-manager";
import { PendingSignups } from "@/components/users/pending-signups";

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

  const canApprove = can("signups.approve", permissions);
  const [users, departments, pending] = await Promise.all([
    listUsers(),
    listDepartments(),
    canApprove ? listPendingSignups() : Promise.resolve([]),
  ]);

  return (
    <>
      <PageHeader
        title="User Management"
        subtitle="Roles, departments, and access"
      />
      {canApprove && (
        <PendingSignups users={pending} departments={departments} />
      )}
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
