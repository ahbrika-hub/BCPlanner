"use server";

import { revalidatePath } from "next/cache";

import { createTaskSchema } from "@/lib/validations";
import { getCurrentProfile, getCurrentPermissions } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import {
  createTask,
  updateTask,
  getTask,
  transitionTask,
} from "@/lib/data/tasks";
import { listIncompleteBlockers } from "@/lib/data/dependencies";
import { isActiveProject } from "@/lib/data/projects";
import { getGeneralBusinessLineId } from "@/lib/data/business-lines";
import { addComment } from "@/lib/data/comments";
import { ACTION_BY_NAME, type TaskAction } from "@/lib/tasks/transitions";
import { DASHBOARD_UPLOAD_CATEGORY } from "@/lib/dashboard/constants";
import { emailRole, emailUsers } from "@/lib/email/events";
import type { Tables } from "@/lib/data/types";

export type ActionResult =
  | { ok: true; id?: string }
  | { ok: false; error: string };

function fail(error: string): ActionResult {
  return { ok: false, error };
}

function errMessage(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong.";
}

export async function createTaskAction(values: unknown): Promise<ActionResult> {
  const parsed = createTaskSchema.safeParse(values);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }

  try {
    const profile = await getCurrentProfile();
    if (!profile) return fail("Not authenticated.");
    const permissions = await getCurrentPermissions();
    if (!can("tasks.create", permissions)) return fail("Not authorized.");

    // employee + ceo create tasks that must be approved & assigned by a manager
    // (the task lands pending_approval, unassigned). section_head/admin create
    // tasks that are immediately actionable.
    const status =
      profile.role === "section_head" || profile.role === "admin"
        ? "assigned"
        : "pending_approval";
    // A project is linked only for project-type tasks (also enforced by the DB
    // check constraint); never leak a stale project_id onto a department task.
    const project_id =
      parsed.data.task_category === "project"
        ? (parsed.data.project_id ?? null)
        : null;
    // Never attach an inactive project — mirrors the edit path's server-side
    // rule (the create form's picker only lists active projects, but a direct
    // action call must be guarded too).
    if (project_id && !(await isActiveProject(project_id))) {
      return fail("Select an active project.");
    }
    const task = await createTask({
      ...parsed.data,
      project_id,
      created_by: profile.id,
      status,
    });

    if (status === "pending_approval") {
      const supabase = await createClient();
      const ref = `${task.task_no ?? "Task"}: ${task.title}`;
      // Notify everyone who can approve/assign — section_head AND admin.
      for (const role of ["section_head", "admin"] as const) {
        await supabase.rpc("notify_role", {
          p_role: role,
          p_type: "task_assigned",
          p_title: "Task pending approval",
          p_message: ref,
          p_task_id: task.id,
        });
        await emailRole("pending_approval", role, ref);
      }
    }

    revalidatePath("/tasks");
    revalidatePath("/approvals");
    return { ok: true, id: task.id };
  } catch (e) {
    return fail(errMessage(e));
  }
}

/**
 * Edit the descriptive metadata of an existing task. Reuses the create
 * validation (`createTaskSchema`) verbatim — same https-only SharePoint rule and
 * same task_category/project consistency refinement — then writes a strict
 * allowlist of descriptive columns. Status and assignee are intentionally NOT
 * writable here (they flow through the transition and assign guards), and the
 * create-only fields (free-text category, start date, effort hours) are left
 * untouched. Eligibility mirrors the tasks_update RLS policy exactly.
 */
export async function updateTaskAction(
  id: string,
  values: unknown,
): Promise<ActionResult> {
  const parsed = createTaskSchema.safeParse(values);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  try {
    const profile = await getCurrentProfile();
    if (!profile) return fail("Not authenticated.");
    const permissions = await getCurrentPermissions();
    // ceo holds tasks.read_all but not tasks.update, so this gate blocks it.
    if (!can("tasks.update", permissions)) return fail("Not authorized.");

    const existing = await getTask(id);
    if (!existing) return fail("Task not found.");

    // Mirrors tasks_update RLS: creator, current assignee, or a manager
    // (tasks.read_all = admin / section_head). An unrelated employee — who has
    // tasks.update but is neither — is refused here, not just by RLS.
    const eligible =
      existing.created_by === profile.id ||
      existing.assignee_id === profile.id ||
      can("tasks.read_all", permissions);
    if (!eligible) return fail("You are not allowed to edit this task.");

    const d = parsed.data;
    // A project is linked only for project-type tasks; switching to department
    // clears any stale project_id (also guarded by the DB check constraint).
    const project_id =
      d.task_category === "project" ? (d.project_id ?? null) : null;

    // A project can be deactivated after the task was created — never re-point
    // an edit at an inactive project. (Edit-only; create relies on its picker.)
    if (project_id && !(await isActiveProject(project_id))) {
      return fail("Select an active project.");
    }

    const patch: Tables["tasks"]["Update"] = {
      title: d.title,
      description: d.description ?? null,
      priority: d.priority,
      due_date: d.due_date ?? null,
      business_line_id: d.business_line_id ?? null,
      sharepoint_url: d.sharepoint_url ?? null,
      task_category: d.task_category,
      project_id,
    };

    await updateTask(id, patch);
    revalidatePath(`/tasks/${id}`);
    revalidatePath("/tasks");
    return { ok: true, id };
  } catch (e) {
    return fail(errMessage(e));
  }
}

export type TransitionPayload = {
  reason?: string;
  assignee_id?: string;
  closure_summary?: string;
  quality_rating?: number;
};

export async function transitionTaskAction(
  id: string,
  action: TaskAction,
  payload: TransitionPayload = {},
): Promise<ActionResult> {
  const desc = ACTION_BY_NAME[action];
  if (!desc || !desc.to) return fail("Unknown action.");

  try {
    const profile = await getCurrentProfile();
    if (!profile) return fail("Not authenticated.");
    const permissions = await getCurrentPermissions();
    if (!can(desc.permission, permissions)) return fail("Not authorized.");

    const task = await getTask(id);
    if (!task) return fail("Task not found.");

    // BLOCK-START defense-in-depth. Today no transition action targets
    // in_progress (it is entered only via the progress-log path, gated in
    // addUpdateAction), so this branch is currently unreachable — but if a future
    // action ever sets to: "in_progress", the start gate is already here and the
    // DB guard is never reached for a blocked start. validate_task_transition is
    // untouched either way.
    if (desc.to === "in_progress") {
      const incomplete = await listIncompleteBlockers(id);
      if (incomplete.length > 0) {
        const labels = incomplete.map((b) => b.task_no ?? "a task").join(", ");
        return fail(`Blocked by ${labels} (not completed).`);
      }
    }

    const sideEffects: Tables["tasks"]["Update"] = {};

    if (desc.requires === "reason" && !payload.reason?.trim()) {
      return fail("A reason is required.");
    }
    if (desc.requires === "assignee") {
      if (!payload.assignee_id) return fail("Please select an assignee.");
      sideEffects.assignee_id = payload.assignee_id;
    }
    if (desc.requires === "closure") {
      if (!payload.closure_summary?.trim() || !payload.quality_rating) {
        return fail("A closure summary and quality rating are required.");
      }
      sideEffects.closure_summary = payload.closure_summary;
      sideEffects.quality_rating = payload.quality_rating;
    }
    if (action === "approve") sideEffects.approved_by = profile.id;

    await transitionTask(id, desc.to, sideEffects);

    if ((action === "reject" || action === "return") && payload.reason) {
      await addComment({
        task_id: id,
        author_id: profile.id,
        comment_role: profile.role,
        comment_type: "task_specific",
        comment_text: `[${desc.label}] ${payload.reason}`,
      });
    }

    await notifyForTransition(id, action, task, payload);

    revalidatePath(`/tasks/${id}`);
    revalidatePath("/tasks");
    revalidatePath("/approvals");
    revalidatePath("/notifications");
    // Live-on-acceptance: completing a "Dashboard Update" task accepts its
    // snapshot, so the weekly dashboard's latest LIVE snapshot may change.
    if (desc.to === "completed" && task.category === DASHBOARD_UPLOAD_CATEGORY) {
      revalidatePath("/dashboard/weekly");
      revalidatePath("/dashboard");
    }
    return { ok: true, id };
  } catch (e) {
    return fail(errMessage(e));
  }
}

async function notifyForTransition(
  taskId: string,
  action: TaskAction,
  task: {
    task_no: string | null;
    title: string;
    created_by: string;
    assignee_id: string | null;
    category: string | null;
  },
  payload: TransitionPayload,
): Promise<void> {
  const supabase = await createClient();
  const ref = `${task.task_no ?? "Task"}: ${task.title}`;
  const notify = (
    userId: string | null,
    type: Tables["notifications"]["Row"]["type"],
    title: string,
  ) => {
    if (!userId) return Promise.resolve();
    return supabase.rpc("create_notification", {
      p_user_id: userId,
      p_type: type,
      p_title: title,
      p_message: ref,
      p_task_id: taskId,
    });
  };

  switch (action) {
    case "approve":
      await notify(task.created_by, "task_approved", "Task approved");
      break;
    case "reject":
      await notify(task.created_by, "task_rejected", "Task rejected");
      break;
    case "return":
      await notify(
        task.created_by,
        "task_returned",
        "Task returned for modification",
      );
      break;
    case "assign":
      await notify(
        payload.assignee_id ?? null,
        "task_assigned",
        "Task assigned to you",
      );
      await emailUsers("task_assigned", [payload.assignee_id ?? null], ref);
      // Loop the creator in (e.g. a CEO who started the task) on assignment.
      if (task.created_by && task.created_by !== payload.assignee_id) {
        await notify(task.created_by, "task_assigned", "Your task was assigned");
      }
      break;
    case "submit_review":
      await supabase.rpc("notify_role", {
        p_role: "section_head",
        p_type: "task_review_requested",
        p_title: "Task submitted for review",
        p_message: ref,
        p_task_id: taskId,
      });
      await emailRole("pending_review", "section_head", ref);
      break;
    case "close":
      // A completed "Dashboard Update" task means the snapshot the requester
      // (recorded as created_by) asked for is now live — tell them so.
      await notify(
        task.created_by,
        "task_completed",
        task.category === DASHBOARD_UPLOAD_CATEGORY
          ? "Requested dashboard update is live"
          : "Task completed",
      );
      await notify(task.assignee_id, "task_completed", "Task completed");
      await emailUsers("completed", [task.created_by, task.assignee_id], ref);
      break;
    case "cancel":
      await notify(task.assignee_id, "task_cancelled", "Task cancelled");
      await notify(task.created_by, "task_cancelled", "Task cancelled");
      break;
    case "reopen":
      await notify(task.assignee_id, "task_reopened", "Task reopened");
      await notify(task.created_by, "task_reopened", "Task reopened");
      break;
    default:
      break;
  }
}

/**
 * PART A — CEO lightweight "Request a task".
 * A one-line description becomes a task that flows through the SAME pipeline as
 * any CEO-created task: createTaskAction lands it pending_approval, unassigned,
 * created_by = the CEO. We only default the soft fields (priority medium,
 * department category, the catch-all "General" business line) so a manager can
 * refine + assign on conversion. No new permission, no new write path.
 */
export async function requestTaskAction(
  description: unknown,
): Promise<ActionResult> {
  const title = typeof description === "string" ? description.trim() : "";
  const businessLineId = await getGeneralBusinessLineId();
  return createTaskAction({
    title,
    description: title,
    task_category: "department",
    priority: "medium",
    business_line_id: businessLineId ?? undefined,
  });
}

export type ConvertCeoRequestInput = {
  title: string;
  priority: "low" | "medium" | "high" | "critical";
  business_line_id?: string;
  due_date?: string;
  assignee_id: string;
};

/**
 * PART A — manager conversion of a CEO request.
 * Sets priority / business line / due date, then approves and assigns — composed
 * entirely from the EXISTING single-task actions (each re-checks its own
 * permission + RLS), never a blanket UPDATE. The result is a normal assigned
 * task. Stops at the first step that fails and reports it.
 */
export async function convertCeoRequestAction(
  taskId: string,
  input: ConvertCeoRequestInput,
): Promise<ActionResult> {
  const edited = await updateTaskAction(taskId, {
    title: input.title,
    priority: input.priority,
    business_line_id: input.business_line_id,
    due_date: input.due_date,
    task_category: "department",
  });
  if (!edited.ok) return edited;

  const approved = await transitionTaskAction(taskId, "approve");
  if (!approved.ok) return approved;

  return transitionTaskAction(taskId, "assign", {
    assignee_id: input.assignee_id,
  });
}

/**
 * PART B — CEO "request update" nudge on a task the CEO created. Does NOT create
 * a task; delegates to the request_task_update() definer function, which asserts
 * caller=ceo AND created_by=auth.uid() and fans out a notification to the
 * assignee + section_heads + admins (de-duped). Gated by tasks.request_update.
 */
export async function requestTaskUpdateAction(
  taskId: string,
): Promise<ActionResult> {
  try {
    const profile = await getCurrentProfile();
    if (!profile) return fail("Not authenticated.");
    const permissions = await getCurrentPermissions();
    if (!can("tasks.request_update", permissions)) return fail("Not authorized.");

    const supabase = await createClient();
    const { data, error } = await supabase.rpc("request_task_update", {
      p_task_id: taskId,
    });
    if (error) return fail(error.message);

    const status = (data as { status?: string } | null)?.status;
    if (status === "rejected") return fail("You can only nudge your own requests.");

    revalidatePath("/tasks");
    revalidatePath("/notifications");
    return { ok: true, id: taskId };
  } catch (e) {
    return fail(errMessage(e));
  }
}
