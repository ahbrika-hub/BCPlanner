import { cn } from "@/lib/utils";
import { TssLogo } from "@/components/brand/tss-logo";

/**
 * Brand lockup for the app shell — the resolved logo mark plus the wordmark.
 * Reuses {@link TssLogo} (same source resolution + fallback as the auth screens).
 * When `collapsed`, only the square mark shows (icon-rail width); the fallback is
 * a compact "T" tile so the rail still reads as branded when no image is present.
 */
export function BrandLockup({
  collapsed = false,
  className,
}: {
  collapsed?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <TssLogo
        className="size-8 shrink-0 object-contain"
        fallback={
          <span
            aria-hidden="true"
            className="bg-primary text-primary-foreground flex size-8 shrink-0 items-center justify-center rounded-md text-sm font-bold"
          >
            T
          </span>
        }
      />
      {!collapsed && (
        <span className="text-primary text-lg font-semibold tracking-tight whitespace-nowrap">
          TSS Planner
        </span>
      )}
    </span>
  );
}
