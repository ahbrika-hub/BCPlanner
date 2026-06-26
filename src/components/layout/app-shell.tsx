import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppTopbar } from "@/components/layout/app-topbar";
import { CommandPalette } from "@/components/layout/command-palette";
import { Toaster } from "@/components/ui/sonner";

export function AppShell({
  children,
  unreadCount = 0,
}: {
  children: React.ReactNode;
  unreadCount?: number;
}) {
  return (
    <div className="flex h-dvh overflow-hidden">
      {/* Keyboard skip link — visually hidden until focused. */}
      <a
        href="#main-content"
        className="bg-primary text-primary-foreground focus-visible:ring-ring sr-only z-50 rounded-md px-3 py-2 text-sm font-medium focus-visible:not-sr-only focus-visible:fixed focus-visible:top-3 focus-visible:left-3 focus-visible:ring-2"
      >
        Skip to main content
      </a>
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppTopbar unreadCount={unreadCount} />
        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1 overflow-y-auto outline-none"
        >
          <div className="mx-auto w-full max-w-6xl p-4 md:p-8">{children}</div>
        </main>
      </div>
      <CommandPalette />
      <Toaster richColors position="top-right" />
    </div>
  );
}
