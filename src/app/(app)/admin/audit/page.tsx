import { ComingSoon } from "@/components/layout/coming-soon";

export default function Page() {
  return (
    <ComingSoon
      title="Audit Log"
      subtitle="System activity log"
      phase="Phase 5"
      permission="audit.read"
    />
  );
}
