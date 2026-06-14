import {
  LayoutDashboard,
  ListTodo,
  ClipboardCheck,
  Bell,
  Gauge,
  TrendingUp,
  RefreshCw,
  BarChart3,
  UserCog,
  Settings,
  Shield,
  FolderKanban,
  LayoutTemplate,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  /**
   * Permission key(s) gating this item. A string array means **any-of** and is
   * used where the route guard accepts more than one key (e.g. `read` OR
   * `read_all`). The value here MUST mirror the page's existing guard so nav
   * visibility never drifts from authorization — the sidebar reflects access,
   * it never defines it.
   */
  permission: string | string[];
};

export type NavSection = {
  /** Group heading (muted small-caps). */
  group: string;
  items: NavItem[];
};

/**
 * Role-aware IA. Items are filtered at render time against the session's
 * resolved permission set (see AppNav) — there is deliberately NO role→item map
 * here, so the nav can never grant or hide access the guards/RLS don't already.
 *
 * Each `permission` mirrors the matching route guard:
 *   - /dashboard, /tasks, /notifications have no hard guard (authenticated-only);
 *     they use the natural read permission as a display key.
 *   - /workload, /performance guards accept `read` OR `read_all` → any-of.
 *   - /admin/users guard checks `users.read` (not `users.manage`).
 */
export const navSections: NavSection[] = [
  {
    group: "Work",
    items: [
      {
        label: "Dashboard",
        href: "/dashboard",
        icon: LayoutDashboard,
        permission: "dashboard.view",
      },
      {
        label: "Tasks",
        href: "/tasks",
        icon: ListTodo,
        // any-of: tasks.read (employee/section_head/admin) OR tasks.create — the
        // latter surfaces the create-task entry for the CEO (who has tasks.create
        // + tasks.read_all but not tasks.read).
        permission: ["tasks.read", "tasks.create"],
      },
      {
        label: "Approvals",
        href: "/approvals",
        icon: ClipboardCheck,
        permission: "tasks.approve",
      },
      {
        label: "Notifications",
        href: "/notifications",
        icon: Bell,
        permission: "notifications.read",
      },
    ],
  },
  {
    group: "Oversight",
    items: [
      {
        label: "Workload",
        href: "/workload",
        icon: Gauge,
        permission: ["workload.read", "workload.read_all"],
      },
      {
        label: "Performance",
        href: "/performance",
        icon: TrendingUp,
        permission: ["performance.read", "performance.read_all"],
      },
      {
        label: "Recurring",
        href: "/recurring",
        icon: RefreshCw,
        permission: "recurring.manage",
      },
    ],
  },
  {
    group: "Insight",
    items: [
      {
        label: "Reports",
        href: "/reports",
        icon: BarChart3,
        permission: "reports.read",
      },
      // The weekly ("Business Lines") dashboard is now reached via the selector
      // on the Dashboard page (/dashboard?view=business-lines), so it no longer
      // needs a separate nav entry here.
    ],
  },
  {
    group: "Administration",
    items: [
      {
        label: "Users",
        href: "/admin/users",
        icon: UserCog,
        permission: "users.read",
      },
      {
        label: "Projects",
        href: "/admin/projects",
        icon: FolderKanban,
        permission: "projects.manage",
      },
      {
        label: "Templates",
        href: "/admin/templates",
        icon: LayoutTemplate,
        permission: "templates.manage",
      },
      {
        label: "Settings",
        href: "/admin/settings",
        icon: Settings,
        permission: "settings.read",
      },
      {
        label: "Audit",
        href: "/admin/audit",
        icon: Shield,
        permission: "audit.read",
      },
    ],
  },
];

/** True when the session holds ANY of the item's permission key(s). */
export function canSeeNavItem(
  permission: string | string[],
  permissions: string[],
): boolean {
  const keys = Array.isArray(permission) ? permission : [permission];
  return keys.some((k) => permissions.includes(k));
}
