import { TaskDetailContent } from "@/components/tasks/task-detail-content";

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <TaskDetailContent id={id} />;
}
