"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, LogOut } from "lucide-react";

import { cn } from "@/lib/utils";
import { signOut } from "@/lib/auth/actions";
import { useSession } from "@/components/providers/session-provider";
import { AppNav } from "@/components/layout/app-nav";
import { BrandLockup } from "@/components/layout/brand-lockup";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

function initials(name: string, email: string): string {
  const source = name.trim() || email;
  const parts = source.split(/[\s@.]+/).filter(Boolean);
  return (parts[0]?.[0] ?? "?").concat(parts[1]?.[0] ?? "").toUpperCase();
}

const roleLabels: Record<string, string> = {
  admin: "Admin",
  section_head: "Section Head",
  employee: "Employee",
  ceo: "CEO",
};

export function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const { profile } = useSession();

  return (
    <aside
      data-collapsed={collapsed}
      className={cn(
        "bg-sidebar text-sidebar-foreground hidden h-dvh shrink-0 flex-col border-r md:flex",
        "transition-[width] duration-200 ease-in-out motion-reduce:transition-none",
        collapsed ? "w-16" : "w-60",
      )}
    >
      {/* Brand / logo lockup */}
      <div
        className={cn(
          "flex h-14 items-center gap-2 border-b px-4",
          collapsed && "justify-center px-2",
        )}
      >
        {!collapsed && <BrandLockup />}
        <Button
          variant="ghost"
          size="icon"
          className={cn("size-7", !collapsed && "ml-auto")}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          onClick={() => setCollapsed((c) => !c)}
        >
          {collapsed ? (
            <ChevronRight className="size-4" />
          ) : (
            <ChevronLeft className="size-4" />
          )}
        </Button>
      </div>

      {/* Nav */}
      <ScrollArea className="flex-1 px-2 py-3">
        <AppNav collapsed={collapsed} />
      </ScrollArea>

      {/* User — pinned, never compressed away (shrink-0) so the signed-in
          name + sign-out stay visible at 100% zoom on 1280/1440. */}
      <div className="shrink-0 border-t p-3">
        <div
          className={cn(
            "flex items-center gap-3",
            collapsed && "justify-center",
          )}
        >
          <Avatar className="size-8">
            <AvatarFallback className="bg-primary text-primary-foreground text-xs">
              {initials(profile.full_name, profile.email)}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {profile.full_name || profile.email}
              </p>
              <Badge
                variant="secondary"
                className="mt-0.5 h-5 px-1.5 text-[10px]"
              >
                {roleLabels[profile.role] ?? profile.role}
              </Badge>
            </div>
          )}
          <form action={signOut} className="shrink-0">
            <Button
              type="submit"
              variant="ghost"
              size="icon"
              className="size-8"
              aria-label="Sign out"
            >
              <LogOut className="size-4" />
            </Button>
          </form>
        </div>
      </div>
    </aside>
  );
}
