"use server";

import { revalidatePath } from "next/cache";

import {
  markRead,
  markAllRead,
  markByIds,
  deleteByIds,
} from "@/lib/data/notifications";
import { getCurrentProfile } from "@/lib/auth/session";
import type { ActionResult } from "@/lib/actions/tasks";

// Revalidate the notifications list AND the (app) layout so the bell badge
// (unread count) refreshes too.
function revalidateNotifications() {
  revalidatePath("/notifications", "layout");
}

function cleanIds(ids: unknown): string[] {
  if (!Array.isArray(ids)) return [];
  return ids.filter((x): x is string => typeof x === "string" && x.length > 0);
}

export async function markNotificationReadAction(
  id: string,
): Promise<ActionResult> {
  try {
    await markRead(id);
    revalidateNotifications();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

async function bulk(
  ids: unknown,
  run: (userId: string, ids: string[]) => Promise<void>,
): Promise<ActionResult> {
  const list = cleanIds(ids);
  if (list.length === 0) return { ok: false, error: "Nothing selected." };
  try {
    const profile = await getCurrentProfile();
    if (!profile) return { ok: false, error: "Not authenticated." };
    // Owner-scoped at the data layer (user_id) and by RLS.
    await run(profile.id, list);
    revalidateNotifications();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

/** Bulk mark the given (own) notifications as read. */
export async function markNotificationsRead(
  ids: string[],
): Promise<ActionResult> {
  return bulk(ids, (uid, list) => markByIds(uid, list, true));
}

/** Bulk mark the given (own) notifications as unread. */
export async function markNotificationsUnread(
  ids: string[],
): Promise<ActionResult> {
  return bulk(ids, (uid, list) => markByIds(uid, list, false));
}

/** Bulk delete the given (own) notifications. */
export async function deleteNotifications(
  ids: string[],
): Promise<ActionResult> {
  return bulk(ids, (uid, list) => deleteByIds(uid, list));
}

export async function markAllNotificationsReadAction(): Promise<ActionResult> {
  try {
    await markAllRead();
    revalidateNotifications();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}
