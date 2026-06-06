import { ComingSoon } from "@/components/layout/coming-soon";

export default function Page() {
  return (
    <ComingSoon
      title="Tasks"
      subtitle="Manage and track tasks"
      phase="Phase 4"
      permission="tasks.read"
    />
  );
}
