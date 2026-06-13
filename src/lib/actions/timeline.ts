"use server";

import { getCurrentProfile } from "@/lib/auth/session";
import {
  getTaskTimeline,
  type TimelineCursor,
  type TimelinePage,
} from "@/lib/data/timeline";

/**
 * "Load more" endpoint for the task activity timeline. Read-only; the underlying
 * data layer runs under the caller's RLS-scoped session client, so a viewer only
 * receives entries they may see (a non-member gets an empty page; ceo/employee
 * get no audit-sourced status entries).
 */
export async function loadTaskTimeline(
  taskId: string,
  cursor: TimelineCursor | null,
): Promise<TimelinePage> {
  const profile = await getCurrentProfile();
  if (!profile) return { entries: [], nextCursor: null };
  return getTaskTimeline(taskId, cursor);
}
