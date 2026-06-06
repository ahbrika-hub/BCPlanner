import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Tables, CommentWithAuthor } from "./types";

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
