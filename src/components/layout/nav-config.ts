import {
  LayoutDashboard,
  ListTodo,
  ClipboardCheck,
  Users,
  Bell,
  BarChart3,
  TrendingUp,
  RefreshCw,
  UserCog,
  Settings,
  Shield,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  permission: string;
};

export type NavSection = {
  /** Optional group heading; omitted for the primary section. */
  group?: string;
  items: NavItem[];
};

export const navSections: NavSection[] = [
  {
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
        permission: "tasks.read",
      },
      {
        label: "Approvals",
        href: "/approvals",
        icon: ClipboardCheck,
        permission: "tasks.approve",
      },
      {
        label: "Workload",
        href: "/workload",
        icon: Users,
        permission: "workload.read",
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
    group: "Reports & Analysis",
    items: [
      {
        label: "Reports",
        href: "/reports",
        icon: BarChart3,
        permission: "reports.read",
      },
      {
        label: "Performance",
        href: "/performance",
        icon: TrendingUp,
        permission: "performance.read",
      },
    ],
  },
  {
    group: "Administration",
    items: [
      {
        label: "Recurring Tasks",
        href: "/recurring",
        icon: RefreshCw,
        permission: "recurring.manage",
      },
      {
        label: "Users",
        href: "/admin/users",
        icon: UserCog,
        permission: "users.manage",
      },
      {
        label: "Settings",
        href: "/admin/settings",
        icon: Settings,
        permission: "settings.read",
      },
      {
        label: "Audit Log",
        href: "/admin/audit",
        icon: Shield,
        permission: "audit.read",
      },
    ],
  },
];
