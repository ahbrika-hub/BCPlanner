"use client";

import { useId } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
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
  const { permissions } = useSession();
  const labelId = useId();

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
