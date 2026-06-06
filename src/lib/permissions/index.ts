import { redirect } from "next/navigation";

/**
 * Client- and server-safe permission check.
 * Permissions are the user's resolved permission keys (from role_permissions).
 */
export function can(permission: string, permissions: string[]): boolean {
  return permissions.includes(permission);
}

/**
 * Server-side guard for Server Components / Server Actions. Redirects to
 * /unauthorized when the permission is missing. Route-level auth lives in
 * the (app) layout; this is an extra in-handler guard.
 */
export function requirePermission(
  permission: string,
  permissions: string[],
): void {
  if (!can(permission, permissions)) {
    redirect("/unauthorized");
  }
}
