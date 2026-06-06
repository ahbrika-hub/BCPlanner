import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

export function KpiCard({
  label,
  value,
  icon: Icon,
  hint,
  accent,
}: {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  hint?: string;
  accent?: string; // CSS color for the icon, defaults to brand primary
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 pt-6">
        {Icon && (
          <div
            className="flex size-10 shrink-0 items-center justify-center rounded-md"
            style={{
              color: accent ?? "var(--primary)",
              backgroundColor: `color-mix(in srgb, ${accent ?? "var(--primary)"} 10%, transparent)`,
            }}
          >
            <Icon className="size-5" />
          </div>
        )}
        <div className="min-w-0">
          <p className="text-muted-foreground text-xs">{label}</p>
          <p className={cn("text-2xl font-semibold tracking-tight")}>{value}</p>
          {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
