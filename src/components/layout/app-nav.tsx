"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { can } from "@/lib/permissions";
import { useSession } from "@/components/providers/session-provider";
import { navSections } from "@/components/layout/nav-config";
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

  return (
    <nav className="flex flex-col gap-4">
      {navSections.map((section, i) => {
        const visible = section.items.filter((item) =>
          can(item.permission, permissions),
        );
        if (visible.length === 0) return null;

        return (
          <div
            key={section.group ?? `section-${i}`}
            className="flex flex-col gap-1"
          >
            {section.group && !collapsed && (
              <p className="text-muted-foreground px-3 pt-2 text-xs font-medium tracking-wide uppercase">
                {section.group}
              </p>
            )}
            {visible.map((item) => {
              const active =
                pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = item.icon;
              const link = (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    collapsed && "justify-center px-2",
                    active
                      ? "bg-sidebar-accent text-sidebar-accent-foreground border-primary border-l-2"
                      : "text-sidebar-foreground/80",
                  )}
                >
                  <Icon className="size-4 shrink-0" aria-hidden="true" />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </Link>
              );

              if (collapsed) {
                return (
                  <Tooltip key={item.href}>
                    <TooltipTrigger asChild>{link}</TooltipTrigger>
                    <TooltipContent side="right">{item.label}</TooltipContent>
                  </Tooltip>
                );
              }
              return link;
            })}
          </div>
        );
      })}
    </nav>
  );
}
