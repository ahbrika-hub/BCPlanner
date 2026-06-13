import { redirect } from "next/navigation";

import {
  getCurrentUser,
  getCurrentProfile,
  getCurrentPermissions,
} from "@/lib/auth/session";
import { getUnreadCount } from "@/lib/data/notifications";
import { SessionProvider } from "@/components/providers/session-provider";
import { AppShell } from "@/components/layout/app-shell";

export default async function AppLayout({
  children,
  modal,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  // Independent of one another (profile, permissions, and the unread badge),
  // so fetch them in parallel. `getCurrentUser()` is `cache()`-wrapped, so the
  // profile fetch reuses the session already resolved above.
  const [profile, permissions, unreadCount] = await Promise.all([
    getCurrentProfile(),
    getCurrentPermissions(),
    getUnreadCount(),
  ]);

  if (!profile || !profile.is_active) {
    redirect(
      profile?.account_status === "pending"
        ? "/login?error=pending"
        : "/login?error=inactive",
    );
  }

  return (
    <SessionProvider value={{ user, profile, permissions }}>
      <AppShell unreadCount={unreadCount}>
        {children}
        {modal}
      </AppShell>
    </SessionProvider>
  );
}
