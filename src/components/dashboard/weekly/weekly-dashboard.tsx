"use client";

import { useState } from "react";
import { ArrowDown, ArrowRight, ArrowUp } from "lucide-react";

import type {
  DashboardData,
  DashboardKpi,
  PeriodId,
} from "@/lib/validations/dashboard";
import { cn } from "@/lib/utils";
import { arrow, ragColor } from "@/lib/dashboard/format";
import {
  BusinessLineSelector,
  type SelectorLine,
} from "@/components/dashboard/weekly/business-line-selector";
import { WeeklyChart } from "@/components/dashboard/weekly/weekly-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// ── KPI tile ─────────────────────────────────────────────────────────────────

function KpiTile({ kpi, period }: { kpi: DashboardKpi; period: PeriodId }) {
  const dir = arrow(kpi.delta);
  const ArrowIcon =
    dir === "up" ? ArrowUp : dir === "down" ? ArrowDown : ArrowRight;
  const pct = kpi.target
    ? Math.max(
        0,
        Math.min(100, Math.round((kpi.target.value / kpi.target.target) * 100)),
      )
    : null;

  return (
    <Card className="gap-0 py-0">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="text-fg-muted text-xs font-medium">{kpi.label}</p>
          <span
            aria-hidden="true"
            className="mt-1 size-2 shrink-0 rounded-full"
            style={{ backgroundColor: ragColor(kpi.rag) }}
            title={kpi.rag}
          />
        </div>
        <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">
          {kpi.values[period]}
        </p>
        <div className="text-fg-muted mt-1 flex items-center gap-1 text-xs">
          {kpi.delta ? (
            <>
              <ArrowIcon className="size-3" aria-hidden="true" />
              <span>{kpi.delta}</span>
            </>
          ) : null}
          {kpi.note ? <span className="truncate">· {kpi.note}</span> : null}
        </div>
        {pct !== null && (
          <div className="mt-2">
            <div className="bg-muted h-1.5 overflow-hidden rounded-full">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${pct}%`,
                  backgroundColor: "var(--bl-accent)",
                }}
              />
            </div>
            <p className="text-fg-muted mt-1 text-[11px]">
              {kpi.target!.value}
              {kpi.target!.suffix ?? ""} / {kpi.target!.target}
              {kpi.target!.suffix ?? ""}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── table cell ───────────────────────────────────────────────────────────────

type Cell =
  | string
  | number
  | null
  | { label: string }
  | { label: string; level: string }
  | { value: number; max: number; color?: string; display?: string }
  | { pct: number; color?: string; caption?: string };

function levelColor(level: string): string {
  return level === "green"
    ? "var(--color-success)"
    : level === "amber"
      ? "var(--color-warning)"
      : level === "red"
        ? "var(--color-danger)"
        : "var(--color-muted-foreground)";
}

function CellView({ value }: { value: Cell }) {
  if (value === null || value === undefined) return <span>—</span>;
  if (typeof value === "string" || typeof value === "number")
    return <span className="tabular-nums">{value}</span>;

  if ("pct" in value) {
    return (
      <div className="flex items-center gap-2">
        <div className="bg-muted h-1.5 w-16 overflow-hidden rounded-full">
          <div
            className="h-full rounded-full"
            style={{
              width: `${Math.max(0, Math.min(100, value.pct))}%`,
              backgroundColor: value.color ?? "var(--bl-accent)",
            }}
          />
        </div>
        <span className="text-fg-muted text-xs">
          {value.pct}%{value.caption ? ` ${value.caption}` : ""}
        </span>
      </div>
    );
  }
  if ("value" in value && "max" in value) {
    const pct = value.max ? (value.value / value.max) * 100 : 0;
    return (
      <div className="flex items-center gap-2">
        <div className="bg-muted h-1.5 w-16 overflow-hidden rounded-full">
          <div
            className="h-full rounded-full"
            style={{
              width: `${Math.max(0, Math.min(100, pct))}%`,
              backgroundColor: value.color ?? "var(--bl-accent)",
            }}
          />
        </div>
        <span className="text-fg-muted text-xs">
          {value.display ?? `${value.value}/${value.max}`}
        </span>
      </div>
    );
  }
  if ("level" in value) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium">
        <span
          aria-hidden="true"
          className="size-1.5 rounded-full"
          style={{ backgroundColor: levelColor(value.level) }}
        />
        {value.label}
      </span>
    );
  }
  // chip
  return (
    <span className="bg-muted text-fg inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium">
      {value.label}
    </span>
  );
}

function WeeklyTable({
  table,
}: {
  table: DashboardData["businessLines"][number]["tables"][number];
}) {
  return (
    <Table stickyFirstColumn>
      <TableHeader>
        <TableRow>
          {table.columns.map((c) => (
            <TableHead
              key={c.key}
              className={
                c.kind === "num" || c.kind === "currency" ? "text-right" : ""
              }
            >
              {c.label}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {table.rows.map((row, i) => (
          <TableRow key={i}>
            {table.columns.map((c) => (
              <TableCell
                key={c.key}
                className={cn(
                  "font-medium",
                  (c.kind === "num" || c.kind === "currency") &&
                    "text-right tabular-nums",
                )}
              >
                <CellView value={(row[c.key] ?? null) as Cell} />
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

// ── main ─────────────────────────────────────────────────────────────────────

export function WeeklyDashboard({
  data,
  logos,
}: {
  data: DashboardData;
  logos: Record<string, string>;
}) {
  const [period, setPeriod] = useState<PeriodId>(data.meta.defaultPeriod);
  const [blId, setBlId] = useState(
    data.meta.defaultBl || data.businessLines[0]?.id || "",
  );
  const bl =
    data.businessLines.find((b) => b.id === blId) ?? data.businessLines[0];

  const lines: SelectorLine[] = data.businessLines.map((b) => ({
    id: b.id,
    name: b.name,
    accent: b.accent,
    logoUrl: logos[b.name],
  }));

  return (
    <div
      className="space-y-6"
      style={{ "--bl-accent": bl?.accent } as React.CSSProperties}
    >
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {data.meta.title || "Weekly dashboard"}
        </h1>
        {(data.meta.subtitle || data.meta.lastRefreshed) && (
          <p className="text-fg-muted mt-1 text-sm">
            {data.meta.subtitle}
            {data.meta.lastRefreshed
              ? ` · refreshed ${data.meta.lastRefreshed}`
              : ""}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <BusinessLineSelector lines={lines} active={blId} onSelect={setBlId} />
        <div
          role="tablist"
          aria-label="Period"
          className="border-border inline-flex shrink-0 rounded-md border p-0.5"
        >
          {data.meta.periods.map((p) => (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={period === p.id}
              onClick={() => setPeriod(p.id)}
              className={cn(
                "focus-visible:ring-ring/50 rounded px-3 py-1 text-sm font-medium outline-none focus-visible:ring-2",
                period === p.id
                  ? "bg-primary text-primary-foreground"
                  : "text-fg-muted hover:text-fg",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {bl && (
        <div className="space-y-8">
          {bl.kpiGroups.map((group) => (
            <section key={group.title} aria-label={group.title}>
              <div className="mb-3">
                <h2 className="text-lg font-semibold tracking-tight">
                  {group.title}
                </h2>
                {group.subtitle && (
                  <p className="text-fg-muted text-sm">{group.subtitle}</p>
                )}
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {group.kpis.map((kpi) => (
                  <KpiTile key={kpi.id} kpi={kpi} period={period} />
                ))}
              </div>
            </section>
          ))}

          {bl.charts.length > 0 && (
            <div className="grid gap-6 lg:grid-cols-2">
              {bl.charts.map((chart) => (
                <Card key={chart.id}>
                  <CardHeader>
                    <CardTitle>{chart.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <WeeklyChart chart={chart} />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {bl.tables.map((table) => (
            <Card key={table.id}>
              <CardHeader>
                <CardTitle>{table.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <WeeklyTable table={table} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {(data.meta.footLeft || data.meta.footRight) && (
        <div className="text-fg-muted flex justify-between border-t pt-4 text-xs">
          <span>{data.meta.footLeft}</span>
          <span>{data.meta.footRight}</span>
        </div>
      )}
    </div>
  );
}
