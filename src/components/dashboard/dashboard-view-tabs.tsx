"use client";

import Link from "next/link";

import { cn } from "@/lib/utils";

export type DashboardView = "department" | "business-lines";

const TABS: { id: DashboardView; label: string; href: string }[] = [
  { id: "department", label: "Department", href: "/dashboard" },
  {
    id: "business-lines",
    label: "Business Lines",
    href: "/dashboard?view=business-lines",
  },
];

/**
 * Segmented control switching the Dashboard area between the existing
 * Department (operational) view and the Business Lines (weekly) view. Rendered
 * only when the viewer can read the weekly dashboard; navigation is via the
 * `view` query param so each view stays server-rendered.
 */
export function DashboardViewTabs({ active }: { active: DashboardView }) {
  return (
    <div
      role="tablist"
      aria-label="Dashboard view"
      className="border-border mb-6 inline-flex rounded-md border p-0.5"
    >
      {TABS.map((t) => (
        <Link
          key={t.id}
          href={t.href}
          role="tab"
          aria-selected={active === t.id}
          className={cn(
            "focus-visible:ring-ring/50 rounded px-3 py-1 text-sm font-medium outline-none focus-visible:ring-2",
            active === t.id
              ? "bg-primary text-primary-foreground"
              : "text-fg-muted hover:text-fg",
          )}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
