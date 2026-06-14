import type { Database } from "@/types/database.types";

export type Tables = Database["public"]["Tables"];
export type TaskStatus = Database["public"]["Enums"]["task_status"];
export type TaskPriority = Database["public"]["Enums"]["task_priority"];
export type UserRole = Database["public"]["Enums"]["user_role"];
export type CommentType = Database["public"]["Enums"]["comment_type_enum"];
export type NotificationType = Database["public"]["Enums"]["notification_type"];

type ProfileRef = { id: string; full_name: string } | null;
// The creator ref also carries role so surfaces can detect a "CEO request"
// (created_by role = ceo) without an extra query.
type CreatorRef = { id: string; full_name: string; role: UserRole } | null;
type BusinessLineRef = { id: string; name: string } | null;

export type TaskRow = Tables["tasks"]["Row"];

export type TaskWithRelations = TaskRow & {
  assignee: ProfileRef;
  creator: CreatorRef;
  approver: ProfileRef;
  business_line: BusinessLineRef;
  project: { id: string; name: string } | null;
};

export type TaskUpdateWithUser = Tables["task_updates"]["Row"] & {
  updater: ProfileRef;
};

export type CommentWithAuthor = Tables["task_comments"]["Row"] & {
  author: ProfileRef;
  addresser: ProfileRef;
};

export type AttachmentWithUploader = Tables["task_attachments"]["Row"] & {
  uploader: ProfileRef;
};

export type WorkloadRow =
  Database["public"]["Views"]["daily_employee_workload"]["Row"];
export type NotificationRow = Tables["notifications"]["Row"];
export type BusinessLineRow = Tables["business_lines"]["Row"];
export type AssignableUser = Pick<
  Tables["profiles"]["Row"],
  "id" | "full_name" | "email" | "role"
>;
