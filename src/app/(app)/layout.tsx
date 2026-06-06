import { redirect } from "next/navigation";

import {
  getCurrentUser,
  getCurrentProfile,
  getCurrentPermissions,
} from "@/lib/auth/session";
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
    redirect("/login?error=inactive");
  }

  const permissions = await getCurrentPermissions(profile.role);

  return (
    <SessionProvider value={{ user, profile, permissions }}>
      <AppShell>{children}</AppShell>
    </SessionProvider>
  );
}
