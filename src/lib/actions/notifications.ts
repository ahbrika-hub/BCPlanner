"use server";

import { revalidatePath } from "next/cache";

import { markRead, markAllRead } from "@/lib/data/notifications";
import type { ActionResult } from "@/lib/actions/tasks";

export async function markNotificationReadAction(
  id: string,
): Promise<ActionResult> {
  try {
    await markRead(id);
    revalidatePath("/notifications");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

export async function markAllNotificationsReadAction(): Promise<ActionResult> {
  try {
    await markAllRead();
    revalidatePath("/notifications");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}
