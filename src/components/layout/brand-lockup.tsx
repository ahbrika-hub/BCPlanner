import { cn } from "@/lib/utils";

/**
 * Brand lockup — a defined header zone for the wordmark + (future) logo file.
 *
 * The mark is a styled placeholder slot sized at 28×28 to match the wordmark
 * cap height; swap it for an `<Image>` when the official asset lands. No logic.
 * When `collapsed`, only the mark shows (icon-rail width).
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
      {/* Logo mark slot — replace with the logo file when supplied. */}
      <span
        aria-hidden="true"
        className="bg-primary text-primary-foreground flex size-7 shrink-0 items-center justify-center rounded-md text-sm font-bold"
      >
        T
      </span>
      {!collapsed && (
        <span className="text-primary text-lg font-semibold tracking-tight whitespace-nowrap">
          TSS Planner
        </span>
      )}
    </span>
  );
}
