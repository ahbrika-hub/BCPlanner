import { PageHeaderSkeleton, ListSkeleton } from "@/components/ui/skeletons";

export default function NotificationsLoading() {
  return (
    <>
      <PageHeaderSkeleton />
      <ListSkeleton rows={6} />
    </>
  );
}
