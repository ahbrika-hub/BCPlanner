import { ComingSoon } from "@/components/layout/coming-soon";

export default function Page() {
  return (
    <ComingSoon
      title="Approvals"
      subtitle="Tasks awaiting your approval"
      phase="Phase 4"
      permission="tasks.approve"
    />
  );
}
