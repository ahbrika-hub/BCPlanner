"use client";

import { useState } from "react";
import type { LucideIcon } from "lucide-react";

import { KpiCard } from "@/components/ui/kpi-card";
import { DrilldownDialog } from "@/components/dashboard/drilldown-dialog";
import type { DrilldownKey } from "@/lib/actions/dashboard-drilldown";

/**
 * A KpiCard that opens a drill-down popup of the records behind its number.
 * Presentational props are passed straight through to {@link KpiCard}; the card
 * becomes a dialog trigger (keyboard-focusable, aria-haspopup).
 */
export function DrilldownKpi({
  label,
  value,
  icon,
  accent,
  drilldown,
  title,
  description,
  viewAllHref,
}: {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  accent?: string;
  drilldown: DrilldownKey;
  title: string;
  description?: string;
  viewAllHref?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={`${label}: ${value} — view records`}
        className="group focus-visible:ring-ring/50 block rounded-xl text-left outline-none focus-visible:ring-2"
      >
        <KpiCard
          label={label}
          value={value}
          icon={icon}
          accent={accent}
          className="transition-shadow group-hover:border-primary/40 group-hover:shadow-md motion-reduce:transition-none"
        />
      </button>
      <DrilldownDialog
        open={open}
        onOpenChange={setOpen}
        title={title}
        description={description}
        drilldown={drilldown}
        viewAllHref={viewAllHref}
      />
    </>
  );
}
