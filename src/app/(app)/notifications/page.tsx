import { ComingSoon } from "@/components/layout/coming-soon";

export default function Page() {
  return (
    <ComingSoon
      title="Notifications"
      subtitle="Your alerts and updates"
      phase="Phase 4"
      permission="notifications.read"
    />
  );
}
