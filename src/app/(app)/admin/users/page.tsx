import { ComingSoon } from "@/components/layout/coming-soon";

export default function Page() {
  return (
    <ComingSoon
      title="User Management"
      subtitle="Manage users and roles"
      phase="Phase 5"
      permission="users.manage"
    />
  );
}
