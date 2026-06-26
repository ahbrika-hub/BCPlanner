"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/components/providers/session-provider";

/**
 * Live notification bell via Supabase Realtime — FLAG-GATED and graceful.
 *
 * When `NEXT_PUBLIC_REALTIME_ENABLED === "true"`, subscribes to Postgres Changes
 * on `public.notifications` scoped to the current user's own rows
 * (`user_id=eq.<id>`). Existing RLS (notifications_select: user_id = auth.uid())
 * means a user can only ever receive their own rows even if the filter were
 * absent. On any INSERT/UPDATE/DELETE it calls `router.refresh()`, which re-runs
 * the server components that already render the bell badge (unread count) and the
 * notifications list — so the UI updates in place with NO new write path and no
 * duplicated client state.
 *
 * When the flag is off/unset, or if the subscription cannot be established, this
 * renders nothing and does nothing: the bell keeps today's refresh-on-navigate
 * behavior with no errors and no broken UI.
 *
 * NOTE (manual op): live delivery also requires `public.notifications` to be in
 * the `supabase_realtime` publication (Supabase dashboard) — see the handoff.
 */
export function RealtimeNotifications() {
  const router = useRouter();
  const { user } = useSession();
  const userId = user.id;

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_REALTIME_ENABLED !== "true") return;
    if (!userId) return;

    let active = true;
    let cleanup: (() => void) | undefined;

    try {
      const supabase = createClient();
      const channel = supabase
        .channel(`notifications:${userId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${userId}`,
          },
          () => {
            if (active) router.refresh();
          },
        )
        .subscribe();
      cleanup = () => {
        void supabase.removeChannel(channel);
      };
    } catch {
      // Graceful fallback: any failure to establish the subscription leaves the
      // bell on its existing refresh-on-navigate behavior.
    }

    return () => {
      active = false;
      cleanup?.();
    };
  }, [userId, router]);

  return null;
}
