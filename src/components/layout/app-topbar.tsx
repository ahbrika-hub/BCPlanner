"use client";

import { useState } from "react";
import { Menu, Bell, LogOut } from "lucide-react";

import { signOut } from "@/lib/auth/actions";
import { useSession } from "@/components/providers/session-provider";
import { AppNav } from "@/components/layout/app-nav";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function initials(name: string, email: string): string {
  const source = name.trim() || email;
  const parts = source.split(/[\s@.]+/).filter(Boolean);
  return (parts[0]?.[0] ?? "?").concat(parts[1]?.[0] ?? "").toUpperCase();
}

export function AppTopbar() {
  const [open, setOpen] = useState(false);
  const { profile } = useSession();

  return (
    <header className="bg-background flex h-14 items-center gap-2 border-b px-3 md:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Open navigation">
            <Menu className="size-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-72 p-0">
          <SheetHeader className="border-b">
            <SheetTitle className="text-primary">TSS Planner</SheetTitle>
          </SheetHeader>
          <div className="px-2 py-3">
            <AppNav onNavigate={() => setOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>

      <span className="text-primary mx-auto text-base font-semibold">
        TSS Planner
      </span>

      <Button variant="ghost" size="icon" aria-label="Notifications">
        <Bell className="size-5" />
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="User menu">
            <Avatar className="size-7">
              <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                {initials(profile.full_name, profile.email)}
              </AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel className="truncate">
            {profile.full_name || profile.email}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <form action={signOut}>
            <DropdownMenuItem asChild>
              <button type="submit" className="w-full">
                <LogOut className="size-4" />
                Sign out
              </button>
            </DropdownMenuItem>
          </form>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
