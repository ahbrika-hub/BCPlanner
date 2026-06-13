"use server";

import { revalidatePath } from "next/cache";

import { addTaskUpdateSchema } from "@/lib/validations";
import { getCurrentProfile, getCurrentPermissions } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { addUpdate } from "@/lib/data/task-updates";
import { addComment, markAddressed } from "@/lib/data/comments";
import {
  uploadAttachment,
  deleteAttachment,
  getAttachmentSignedUrl,
  getAttachmentByStoragePath,
  getAttachmentById,
  MAX_ATTACHMENT_BYTES,
} from "@/lib/data/attachments";
import type { ActionResult } from "@/lib/actions/tasks";
import type { CommentType } from "@/lib/data/types";

function fail(error: string): ActionResult {
  return { ok: false, error };
}
function errMessage(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong.";
}

const BLOCKED_EXT = ["exe", "sh", "bat", "cmd", "com", "msi", "js", "jar"];

export async function addUpdateAction(
  taskId: string,
  values: unknown,
): Promise<ActionResult> {
  const parsed = addTaskUpdateSchema.safeParse(values);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  try {
    const profile = await getCurrentProfile();
    if (!profile) return fail("Not authenticated.");
    const permissions = await getCurrentPermissions();
    if (!can("task_updates.create", permissions))
      return fail("Not authorized.");

    await addUpdate({
      task_id: taskId,
      updated_by: profile.id,
      ...parsed.data,
    });
    revalidatePath(`/tasks/${taskId}`);
    return { ok: true, id: taskId };
  } catch (e) {
    return fail(errMessage(e));
  }
}

export async function addCommentAction(
  taskId: string,
  text: string,
  commentType: CommentType = "general",
): Promise<ActionResult> {
  if (!text.trim()) return fail("Comment cannot be empty.");
  try {
    const profile = await getCurrentProfile();
    if (!profile) return fail("Not authenticated.");
    const permissions = await getCurrentPermissions();
    if (!can("task_comments.create", permissions))
      return fail("Not authorized.");

    await addComment({
      task_id: taskId,
      author_id: profile.id,
      comment_role: profile.role,
      comment_type: commentType,
      comment_text: text.trim(),
    });

    // CEO office comments alert the section heads to action them.
    if (commentType === "ceo_office_comment") {
      const supabase = await createClient();
      await supabase.rpc("notify_role", {
        p_role: "section_head",
        p_type: "comment_added",
        p_title: "CEO Office comment added",
        p_message: text.trim().slice(0, 140),
        p_task_id: taskId,
      });
    }

    revalidatePath(`/tasks/${taskId}`);
    return { ok: true, id: taskId };
  } catch (e) {
    return fail(errMessage(e));
  }
}

export async function markAddressedAction(
  commentId: string,
  taskId: string,
): Promise<ActionResult> {
  try {
    const profile = await getCurrentProfile();
    if (!profile) return fail("Not authenticated.");
    const permissions = await getCurrentPermissions();
    if (!can("task_comments.address", permissions))
      return fail("Not authorized.");

    await markAddressed(commentId, profile.id);
    revalidatePath(`/tasks/${taskId}`);
    return { ok: true, id: taskId };
  } catch (e) {
    return fail(errMessage(e));
  }
}

export async function uploadAttachmentAction(
  taskId: string,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const profile = await getCurrentProfile();
    if (!profile) return fail("Not authenticated.");
    const permissions = await getCurrentPermissions();
    if (!can("attachments.upload", permissions)) return fail("Not authorized.");

    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return fail("Please choose a file.");
    }
    if (file.size > MAX_ATTACHMENT_BYTES) {
      return fail("File exceeds the 10MB limit.");
    }
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (BLOCKED_EXT.includes(ext)) {
      return fail("That file type is not allowed.");
    }

    await uploadAttachment(taskId, profile.id, file);
    revalidatePath(`/tasks/${taskId}`);
    return { ok: true, id: taskId };
  } catch (e) {
    return fail(errMessage(e));
  }
}

export async function getAttachmentUrlAction(
  path: string,
): Promise<{ ok: boolean; url?: string; error?: string }> {
  try {
    const profile = await getCurrentProfile();
    if (!profile) return { ok: false, error: "Not authenticated." };
    const permissions = await getCurrentPermissions();
    if (!can("attachments.download", permissions))
      return { ok: false, error: "Not authorized." };

    // Storage SELECT RLS is coarse (download permission only, no per-task
    // scoping), so verify per-task visibility here: the attachment must be
    // readable under the caller's RLS context (task_attachments_select) before
    // we mint a signed URL for it.
    const attachment = await getAttachmentByStoragePath(path);
    if (!attachment) return { ok: false, error: "Not authorized." };

    const url = await getAttachmentSignedUrl(attachment.storage_path ?? path);
    if (!url)
      return { ok: false, error: "Could not generate a download link." };
    return { ok: true, url };
  } catch (e) {
    return { ok: false, error: errMessage(e) };
  }
}

export async function deleteAttachmentAction(
  id: string,
  taskId: string,
): Promise<ActionResult> {
  try {
    const profile = await getCurrentProfile();
    if (!profile) return fail("Not authenticated.");
    const permissions = await getCurrentPermissions();

    // Owner-or-manager check mirroring the task_attachments_delete RLS policy
    // (uploaded_by = auth.uid() OR tasks.delete). The lookup itself is RLS-
    // scoped, so an attachment the caller cannot see resolves to null.
    const attachment = await getAttachmentById(id);
    if (!attachment) return fail("Not authorized.");
    const isOwner = attachment.uploaded_by === profile.id;
    if (!isOwner && !can("tasks.delete", permissions))
      return fail("Not authorized.");

    await deleteAttachment(id);
    revalidatePath(`/tasks/${taskId}`);
    return { ok: true, id: taskId };
  } catch (e) {
    return fail(errMessage(e));
  }
}
