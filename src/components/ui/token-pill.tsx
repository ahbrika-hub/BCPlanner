import { cn } from "@/lib/utils";

/**
 * TokenPill — the single shared anatomy for status & priority indicators.
 *
 * Anatomy: tinted background + 6px status dot + readable label, at a consistent
 * 24px height and full radius. It is fed a single CSS color (a design token such
 * as `var(--color-status-completed)` or `var(--color-priority-high)`) and
 * derives the tint, hairline border, and dot from it via `color-mix`, so every
 * pill in the app is visually identical except for hue.
 *
 * Not used directly in pages — use {@link StatusBadge} / {@link PriorityPill}.
 */
export function TokenPill({
  color,
  label,
  className,
}: {
  /** A CSS color or `var(--token)` reference. */
  color: string;
  label: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-full border px-2.5 text-xs leading-none font-medium whitespace-nowrap",
        className,
      )}
      style={{
        color,
        borderColor: `color-mix(in srgb, ${color} 28%, transparent)`,
        backgroundColor: `color-mix(in srgb, ${color} 10%, transparent)`,
      }}
    >
      <span
        aria-hidden
        className="size-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  );
}
