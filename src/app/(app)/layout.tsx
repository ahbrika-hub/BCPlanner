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
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const profile = await getCurrentProfile();
  if (!profile || !profile.is_active) {
    redirect(
      profile?.account_status === "pending"
        ? "/login?error=pending"
        : "/login?error=inactive",
    );
  }

  const permissions = await getCurrentPermissions();
  const unreadCount = await getUnreadCount();

  return (
    <SessionProvider value={{ user, profile, permissions }}>
      <AppShell unreadCount={unreadCount}>{children}</AppShell>
    </SessionProvider>
  );
}
