"use client";

import { useId } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Bookmark } from "lucide-react";

import { cn } from "@/lib/utils";
import { configToQueryString } from "@/lib/tasks/saved-view-config";
import { useSession } from "@/components/providers/session-provider";
import { navSections, canSeeNavItem } from "@/components/layout/nav-config";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function AppNav({
  collapsed = false,
  onNavigate,
}: {
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { permissions, savedViews } = useSession();
  const labelId = useId();
  const activeViewId = searchParams.get("view");

  // Only sections with at least one permitted item are rendered (no disabled
  // rows). Visibility derives purely from the session permission set.
  const sections = navSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) =>
        canSeeNavItem(item.permission, permissions),
      ),
    }))
    .filter((section) => section.items.length > 0);

  return (
    <nav aria-label="Primary" className="flex flex-col gap-4">
      {sections.map((section, i) => {
        const sectionLabelId = `${labelId}-${i}`;
        return (
          <div
            key={section.group}
            role="group"
            aria-labelledby={!collapsed ? sectionLabelId : undefined}
            aria-label={collapsed ? section.group : undefined}
            className={cn(
              "flex flex-col gap-1",
              // Collapsed: a hairline divider replaces the (hidden) label.
              collapsed && i > 0 && "border-sidebar-border mt-1 border-t pt-2",
            )}
          >
            {!collapsed && (
              <p
                id={sectionLabelId}
                className="text-fg-muted px-3 pt-2 text-xs font-medium tracking-wide uppercase"
              >
                {section.group}
              </p>
            )}
            <ul role="list" className="flex flex-col gap-1">
              {section.items.map((item) => {
                const active =
                  pathname === item.href ||
                  pathname.startsWith(`${item.href}/`);
                const Icon = item.icon;
                const link = (
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium",
                      // ≥44px touch target in the mobile drawer; compact on the
                      // desktop sidebar (md+).
                      "min-h-11 md:min-h-9",
                      "transition-colors motion-reduce:transition-none",
                      "focus-visible:ring-ring/50 outline-none focus-visible:ring-2",
                      "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                      collapsed && "justify-center px-2",
                      active
                        ? "bg-sidebar-accent text-sidebar-accent-foreground border-primary border-l-2"
                        : "text-sidebar-foreground/80",
                    )}
                  >
                    <Icon className="size-4 shrink-0" aria-hidden="true" />
                    {!collapsed && (
                      <span className="truncate">{item.label}</span>
                    )}
                  </Link>
                );

                // Personal saved views render as indented sub-links under the
                // Tasks item (expanded sidebar only). They inherit the Tasks
                // item's permission gate — only shown because Tasks is shown —
                // and link to /tasks with the view's stored query string so the
                // existing list filtering does the work. Empty → nothing extra.
                const showSavedViews =
                  item.href === "/tasks" &&
                  !collapsed &&
                  savedViews.length > 0;

                return (
                  <li key={item.href}>
                    {collapsed ? (
                      <Tooltip>
                        <TooltipTrigger asChild>{link}</TooltipTrigger>
                        <TooltipContent side="right">
                          {item.label}
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      link
                    )}
                    {showSavedViews && (
                      <ul role="list" className="mt-1 flex flex-col gap-0.5">
                        {savedViews.map((view) => {
                          const qs = configToQueryString(view.config);
                          const href = `/tasks?${qs ? `${qs}&` : ""}view=${view.id}`;
                          const viewActive =
                            pathname === "/tasks" &&
                            activeViewId === view.id;
                          return (
                            <li key={view.id}>
                              <Link
                                href={href}
                                onClick={onNavigate}
                                aria-current={viewActive ? "page" : undefined}
                                className={cn(
                                  "flex items-center gap-2 rounded-md py-1.5 pr-3 pl-9 text-sm",
                                  "transition-colors motion-reduce:transition-none",
                                  "focus-visible:ring-ring/50 outline-none focus-visible:ring-2",
                                  "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                                  viewActive
                                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                                    : "text-sidebar-foreground/70",
                                )}
                              >
                                <Bookmark
                                  className="size-3.5 shrink-0"
                                  aria-hidden="true"
                                />
                                <span className="truncate">{view.name}</span>
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}
