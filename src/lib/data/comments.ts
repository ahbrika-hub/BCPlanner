import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Tables, CommentWithAuthor } from "./types";

/** A user who can see a task and may therefore be @mentioned on it. */
export type MentionableUser = { id: string; display_name: string };

/**
 * Users who can SEE this task (created_by OR assignee OR holders of
 * tasks.read_all) — the exact task-visibility audience, resolved by the
 * SECURITY DEFINER `task_mentionable_users` function. The DB function also
 * verifies the CALLER can see the task, so it never reveals an audience for a
 * task the caller cannot access. This is the source for the picker AND, re-run
 * inside addCommentAction, the gate on who may actually be notified.
 */
export async function listMentionableUsers(
  taskId: string,
): Promise<MentionableUser[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("task_mentionable_users", {
    p_task_id: taskId,
  });
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Resolve a set of user ids to {id, full_name} for rendering mention chips. */
export async function getDisplayNames(
  ids: string[],
): Promise<{ id: string; full_name: string }[]> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", unique);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function listComments(
  taskId: string,
): Promise<CommentWithAuthor[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("task_comments")
    .select(
      `*,
       author:profiles!task_comments_author_id_fkey(id, full_name),
       addresser:profiles!task_comments_addressed_by_fkey(id, full_name)`,
    )
    .eq("task_id", taskId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as CommentWithAuthor[];
}

export async function addComment(
  input: Tables["task_comments"]["Insert"],
): Promise<Tables["task_comments"]["Row"]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("task_comments")
    .insert(input)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function markAddressed(
  commentId: string,
  addressedBy: string,
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("task_comments")
    .update({
      is_addressed: true,
      addressed_by: addressedBy,
      addressed_at: new Date().toISOString(),
    })
    .eq("id", commentId);
  if (error) throw new Error(error.message);
}
