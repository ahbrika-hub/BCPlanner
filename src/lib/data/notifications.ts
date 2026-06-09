import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { NotificationRow } from "./types";

export async function listNotifications(): Promise<NotificationRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getUnreadCount(): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("is_read", false);
  return count ?? 0;
}

export async function markRead(id: string): Promise<void> {
  const supabase = await createClient();
  await supabase
    .from("notifications")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq("id", id);
}

export async function markAllRead(): Promise<void> {
  const supabase = await createClient();
  await supabase
    .from("notifications")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq("is_read", false);
}

/**
 * Bulk mark read/unread, scoped to the owner both explicitly (user_id) and by
 * RLS (notifications_update policy). Unread clears read_at.
 */
export async function markByIds(
  userId: string,
  ids: string[],
  read: boolean,
): Promise<void> {
  if (ids.length === 0) return;
  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ is_read: read, read_at: read ? new Date().toISOString() : null })
    .eq("user_id", userId)
    .in("id", ids);
  if (error) throw new Error(error.message);
}

/** Bulk delete, scoped to the owner (user_id + RLS notifications_delete). */
export async function deleteByIds(
  userId: string,
  ids: string[],
): Promise<void> {
  if (ids.length === 0) return;
  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .delete()
    .eq("user_id", userId)
    .in("id", ids);
  if (error) throw new Error(error.message);
}
