import { listNotifications } from "@/lib/data/notifications";
import { PageHeader } from "@/components/layout/page-header";
import { NotificationList } from "@/components/notifications/notification-list";

export default async function NotificationsPage() {
  const items = await listNotifications();

  return (
    <>
      <PageHeader title="Notifications" subtitle="Your alerts and updates" />
      <NotificationList items={items} />
    </>
  );
}
