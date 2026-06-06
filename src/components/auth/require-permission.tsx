"use client";

import { ShieldAlert } from "lucide-react";

import { can } from "@/lib/permissions";
import { useSession } from "@/components/providers/session-provider";

/**
 * In-page permission gate. Renders children when the current user holds the
 * permission; otherwise renders the fallback (or a default "access restricted"
 * notice). Route-level auth is handled by the (app) layout.
 */
export function RequirePermission({
  permission,
  children,
  fallback,
}: {
  permission: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const { permissions } = useSession();

  if (can(permission, permissions)) {
    return <>{children}</>;
  }

  if (fallback !== undefined) {
    return <>{fallback}</>;
  }

  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed px-6 py-16 text-center">
      <ShieldAlert className="text-muted-foreground mb-4 size-8" />
      <h3 className="text-base font-semibold">Access restricted</h3>
      <p className="text-muted-foreground mt-1 max-w-sm text-sm">
        You don&apos;t have permission to view this section. Contact an
        administrator if you believe this is a mistake.
      </p>
    </div>
  );
}
