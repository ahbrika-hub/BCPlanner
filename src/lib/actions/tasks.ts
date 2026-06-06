"use server";

import { revalidatePath } from "next/cache";

import { createTaskSchema, updateTaskSchema } from "@/lib/validations";
import { getCurrentProfile, getCurrentPermissions } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import {
  createTask,
  updateTask,
  getTask,
  transitionTask,
} from "@/lib/data/tasks";
import { addComment } from "@/lib/data/comments";
import { ACTION_BY_NAME, type TaskAction } from "@/lib/tasks/transitions";
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

    const status =
      profile.role === "employee" ? "pending_approval" : "assigned";
    const task = await createTask({
      ...parsed.data,
      created_by: profile.id,
      status,
    });

    if (status === "pending_approval") {
      const supabase = await createClient();
      await supabase.rpc("notify_role", {
        p_role: "section_head",
        p_type: "task_assigned",
        p_title: "Task pending approval",
        p_message: `${task.task_no ?? "Task"}: ${task.title}`,
        p_task_id: task.id,
      });
    }

    revalidatePath("/tasks");
    revalidatePath("/approvals");
    return { ok: true, id: task.id };
  } catch (e) {
    return fail(errMessage(e));
  }
}

export async function updateTaskAction(
  id: string,
  values: unknown,
): Promise<ActionResult> {
  const parsed = updateTaskSchema.safeParse(values);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  try {
    const profile = await getCurrentProfile();
    if (!profile) return fail("Not authenticated.");
    const permissions = await getCurrentPermissions();
    if (!can("tasks.update", permissions)) return fail("Not authorized.");

    await updateTask(id, parsed.data as Tables["tasks"]["Update"]);
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
      break;
    case "submit_review":
      await supabase.rpc("notify_role", {
        p_role: "section_head",
        p_type: "task_review_requested",
        p_title: "Task submitted for review",
        p_message: ref,
        p_task_id: taskId,
      });
      break;
    case "close":
      await notify(task.created_by, "task_completed", "Task completed");
      await notify(task.assignee_id, "task_completed", "Task completed");
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
