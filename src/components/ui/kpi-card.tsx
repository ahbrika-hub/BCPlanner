import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

/**
 * KpiCard — a presentational Card variant for a single metric: big number +
 * label + optional icon, hint, and a trend slot. Purely presentational: it
 * takes already-computed props and renders no data of its own.
 *
 * This is the canonical KPI primitive (Phase 1). The existing
 * `components/charts/kpi-card` stays in place for current dashboards and will
 * be migrated to this one in a later rollout phase.
 */
export function KpiCard({
  label,
  value,
  icon: Icon,
  hint,
  trend,
  accent = "var(--primary)",
  className,
}: {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  hint?: string;
  /** Optional trend indicator (e.g. "+12%"); fully presentational. */
  trend?: React.ReactNode;
  /** CSS color for the icon chip; defaults to brand primary. */
  accent?: string;
  className?: string;
}) {
  return (
    <Card className={cn("gap-0 py-0", className)}>
      <CardContent className="flex items-start gap-4 p-5">
        {Icon && (
          <div
            className="flex size-10 shrink-0 items-center justify-center rounded-md"
            style={{
              color: accent,
              backgroundColor: `color-mix(in srgb, ${accent} 10%, transparent)`,
            }}
          >
            <Icon className="size-5" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-fg-muted text-xs font-medium">{label}</p>
          <div className="mt-1 flex items-baseline gap-2">
            <p className="text-2xl font-semibold tracking-tight tabular-nums">
              {value}
            </p>
            {trend && (
              <span className="text-fg-muted text-xs font-medium">{trend}</span>
            )}
          </div>
          {hint && <p className="text-fg-muted mt-1 text-xs">{hint}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
