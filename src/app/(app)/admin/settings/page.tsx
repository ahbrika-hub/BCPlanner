import { ComingSoon } from "@/components/layout/coming-soon";

export default function Page() {
  return (
    <ComingSoon
      title="Settings"
      subtitle="Application configuration"
      phase="Phase 5"
      permission="settings.read"
    />
  );
}
