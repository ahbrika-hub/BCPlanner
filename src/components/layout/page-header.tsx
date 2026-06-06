/**
 * PageHeader — canonical page heading.
 *
 * Anatomy: title + one-line description (left), primary-action slot (right),
 * and an optional filter/segment slot below (`children`). Backward compatible
 * with all existing callers (title / subtitle / actions).
 */
export function PageHeader({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  /** Primary-action slot (right). */
  actions?: React.ReactNode;
  /** Optional filter / segment slot rendered below the title row. */
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {subtitle && <p className="text-fg-muted mt-1 text-sm">{subtitle}</p>}
        </div>
        {actions && (
          <div className="flex shrink-0 items-center gap-2">{actions}</div>
        )}
      </div>
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}
