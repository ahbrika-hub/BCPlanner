import { cn } from "@/lib/utils";

/**
 * EmptyState — canonical empty/zero-data state.
 *
 * Anatomy: optional icon + headline + one-line guidance + optional action slot,
 * centered on a dashed hairline surface. Presentational only: the caller passes
 * its own action node (e.g. a <Button> or a <Link>), so this stays a plain
 * (server-renderable) component.
 */
export function EmptyState({
  title,
  description,
  icon,
  action,
  className,
}: {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  /** Optional action slot (button / link). */
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "border-border flex flex-col items-center justify-center rounded-lg border border-dashed px-6 py-16 text-center",
        className,
      )}
    >
      {icon && <div className="text-fg-muted mb-4">{icon}</div>}
      <h3 className="text-base font-semibold">{title}</h3>
      {description && (
        <p className="text-fg-muted mt-1 max-w-sm text-sm">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
