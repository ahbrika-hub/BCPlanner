import { can } from "@/lib/permissions";
import type { TaskStatus, UserRole } from "@/lib/data/types";

export type TaskAction =
  | "submit_for_approval"
  | "approve"
  | "reject"
  | "return"
  | "assign"
  | "submit_review"
  | "close"
  | "cancel"
  | "reopen"
  | "log_progress";

/** What extra input an action requires before it can be submitted. */
export type ActionInput =
  | "none"
  | "reason"
  | "assignee"
  | "closure"
  | "progress";

export type ActionDescriptor = {
  action: TaskAction;
  label: string;
  permission: string;
  /** Statuses from which this action is offered (matches the DB guard). */
  from: TaskStatus[];
  /** Target status (omitted for log_progress, which advances via an update). */
  to?: TaskStatus;
  requires: ActionInput;
  variant: "default" | "secondary" | "outline" | "destructive";
};

// Single source of truth for the UI, mirroring the Migration 5 transition guard.
export const ACTIONS: ActionDescriptor[] = [
  {
    action: "submit_for_approval",
    label: "Submit for Approval",
    permission: "tasks.update",
    from: ["draft"],
    to: "pending_approval",
    requires: "none",
    variant: "default",
  },
  {
    action: "approve",
    label: "Approve",
    permission: "tasks.approve",
    from: ["pending_approval"],
    to: "approved",
    requires: "none",
    variant: "default",
  },
  {
    action: "reject",
    label: "Reject",
    permission: "tasks.reject",
    from: ["pending_approval"],
    to: "rejected",
    requires: "reason",
    variant: "destructive",
  },
  {
    action: "assign",
    label: "Assign",
    permission: "tasks.assign",
    from: ["approved", "reopened"],
    to: "assigned",
    requires: "assignee",
    variant: "default",
  },
  {
    action: "log_progress",
    label: "Log Progress",
    permission: "task_updates.create",
    from: [
      "assigned",
      "approved",
      "in_progress",
      "pending_update",
      "returned_for_modification",
      "reopened",
    ],
    requires: "progress",
    variant: "secondary",
  },
  {
    action: "submit_review",
    label: "Submit for Review",
    permission: "tasks.submit_review",
    from: [
      "assigned",
      "approved",
      "in_progress",
      "pending_update",
      "returned_for_modification",
      "reopened",
    ],
    to: "pending_review",
    requires: "none",
    variant: "default",
  },
  {
    action: "close",
    label: "Close Task",
    permission: "tasks.close",
    from: ["pending_review"],
    to: "completed",
    requires: "closure",
    variant: "default",
  },
  {
    action: "return",
    label: "Return for Modification",
    permission: "tasks.return",
    from: ["pending_review"],
    to: "returned_for_modification",
    requires: "reason",
    variant: "outline",
  },
  {
    action: "cancel",
    label: "Cancel",
    permission: "tasks.cancel",
    from: [
      "pending_approval",
      "approved",
      "assigned",
      "in_progress",
      "pending_update",
      "pending_review",
      "returned_for_modification",
      "reopened",
    ],
    to: "cancelled",
    requires: "none",
    // Neutral/muted — distinct from Reject (destructive) and Approve (primary)
    // so the three approval-screen actions read as visually distinct.
    variant: "outline",
  },
  {
    action: "reopen",
    label: "Reopen",
    permission: "tasks.reopen",
    from: ["completed", "cancelled", "rejected"],
    to: "reopened",
    requires: "none",
    variant: "outline",
  },
];

export const ACTION_BY_NAME: Record<TaskAction, ActionDescriptor> =
  Object.fromEntries(ACTIONS.map((a) => [a.action, a])) as Record<
    TaskAction,
    ActionDescriptor
  >;

/**
 * Actions the current user may perform from the given status, by permission.
 * Row-level eligibility (assignee vs manager) and transition legality are
 * additionally enforced by RLS and the DB guard at submit time.
 */
export function getAvailableActions(
  status: TaskStatus,
  _role: UserRole,
  permissions: string[],
): ActionDescriptor[] {
  return ACTIONS.filter(
    (a) => a.from.includes(status) && can(a.permission, permissions),
  );
}
