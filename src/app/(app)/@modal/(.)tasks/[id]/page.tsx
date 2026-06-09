import { TaskDetailContent } from "@/components/tasks/task-detail-content";
import { TaskDetailModal } from "@/components/tasks/task-detail-modal";

/**
 * Intercepts soft navigations to /tasks/[id] (from task lists in any role view
 * and from notifications) and shows the task detail in a modal, reusing the
 * same server-side fetch/render as the full page.
 */
export default async function InterceptedTaskDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <TaskDetailModal>
      <TaskDetailContent id={id} />
    </TaskDetailModal>
  );
}
