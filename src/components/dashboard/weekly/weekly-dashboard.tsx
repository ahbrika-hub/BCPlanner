"use client";

import { useState } from "react";

import type {
  DashboardData,
  DashboardKpi,
  PeriodId,
} from "@/lib/validations/dashboard";
import { cn } from "@/lib/utils";
import { arrow } from "@/lib/dashboard/format";
import { WeeklyChart } from "@/components/dashboard/weekly/weekly-chart";

// ── helpers ──────────────────────────────────────────────────────────────────

type DeltaView = { dir: "up" | "down" | "flat"; text: string };

/** Normalize the legacy string delta and the new {dir,text} object to one shape. */
function normalizeDelta(delta: DashboardKpi["delta"]): DeltaView | null {
  if (!delta) return null;
  if (typeof delta === "string")
    return delta ? { dir: arrow(delta), text: delta } : null;
  return delta;
}

const ARROW_CHAR: Record<DeltaView["dir"], string> = {
  up: "↑",
  down: "↓",
  flat: "→",
};
const ARROW_COLOR: Record<DeltaView["dir"], string> = {
  up: "var(--color-rag-green)",
  down: "var(--color-rag-red)",
  flat: "var(--color-rag-amber)",
};
const RAG_DOT: Record<string, string> = {
  green: "var(--color-status-green)",
  amber: "var(--color-status-amber)",
  red: "var(--color-status-red)",
};

// ── brand plate (logo by slug, existing resolver order) ──────────────────────

/** Active line's logo: /business-lines/<slug> svg→png→jpg→jpeg → TSS/SAPTCO text. */
function BrandPlate({ slug, name }: { slug: string; name: string }) {
  const sources = [
    `/business-lines/${slug}.svg`,
    `/business-lines/${slug}.png`,
    `/business-lines/${slug}.jpg`,
    `/business-lines/${slug}.jpeg`,
  ];
  const [idx, setIdx] = useState(0);

  if (idx >= sources.length) {
    return (
      <div className="flex min-h-12 shrink-0 flex-col items-start justify-center rounded-[10px] bg-white px-3 py-2 leading-none">
        <b className="text-[22px] font-bold tracking-[0.02em] text-[var(--color-burgundy)]">
          TSS
        </b>
        <span className="mt-[3px] text-[7.5px] font-bold tracking-[0.14em] text-[var(--color-navy)] uppercase">
          SAPTCO
        </span>
      </div>
    );
  }
  return (
    <div className="flex min-h-12 shrink-0 items-center rounded-[10px] bg-white px-3 py-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={sources[idx]}
        alt={`${name} logo`}
        className="block h-[34px] w-auto"
        onError={() => setIdx((i) => i + 1)}
      />
    </div>
  );
}

// ── KPI tile ─────────────────────────────────────────────────────────────────

function KpiTile({
  kpi,
  period,
  accent,
}: {
  kpi: DashboardKpi;
  period: PeriodId;
  accent: string;
}) {
  const delta = normalizeDelta(kpi.delta);
  const pct = kpi.target
    ? Math.max(
        0,
        Math.min(100, (kpi.target.value / kpi.target.target) * 100),
      )
    : null;

  return (
    <div
      className={cn(
        "relative flex flex-col overflow-hidden rounded-[14px] border border-[var(--color-rule)] p-4 shadow-sm transition-shadow hover:shadow-md",
        kpi.lead ? "bg-[var(--color-surface-page)]" : "bg-[var(--color-surface-card)]",
      )}
    >
      <span
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-[3px]"
        style={{ background: accent }}
      />
      <div className="mb-2.5 flex items-center justify-between gap-2 text-[10.5px] font-bold tracking-[0.07em] text-[var(--color-ink-2)] uppercase">
        <span>{kpi.label}</span>
        {kpi.tag && (
          <span className="rounded-[6px] border border-[var(--color-rule)] bg-[var(--color-hover-soft)] px-1.5 py-0.5 text-[8.5px] font-bold tracking-[0.06em] text-[var(--color-ink-3)]">
            {kpi.tag}
          </span>
        )}
      </div>
      <p
        className={cn(
          "font-bold tracking-[-0.02em] text-[var(--color-ink)]",
          kpi.lead ? "text-[30px]" : "text-[26px]",
          "leading-[1.04]",
        )}
      >
        {kpi.values[period]}
      </p>

      {delta && (
        <div className="mt-[11px] flex items-center gap-[7px] text-xs text-[var(--color-ink-2)]">
          <span className="font-extrabold" style={{ color: ARROW_COLOR[delta.dir] }}>
            {ARROW_CHAR[delta.dir]}
          </span>
          <span>{delta.text}</span>
          {kpi.rag && (
            <span
              aria-hidden="true"
              className="ml-auto size-2 shrink-0 rounded-full"
              style={{ background: RAG_DOT[kpi.rag] }}
              title={kpi.rag}
            />
          )}
        </div>
      )}

      {pct !== null ? (
        <div className="mt-2.5">
          <div className="relative h-1.5 rounded-[3px] bg-[var(--color-hover-soft)]">
            <div
              className="absolute inset-y-0 left-0 rounded-[3px]"
              style={{ width: `${pct}%`, background: accent }}
            />
            <div className="absolute -top-[3px] -bottom-[3px] left-full w-0.5 rounded-[1px] bg-[var(--color-ink-2)]" />
          </div>
          <div className="mt-1 flex justify-between text-[9px] tracking-[0.04em] text-[var(--color-ink-4)] uppercase">
            <span>
              {kpi.target!.value}
              {kpi.target!.suffix ?? ""}
            </span>
            <span>
              Target {kpi.target!.target}
              {kpi.target!.suffix ?? ""}
            </span>
          </div>
        </div>
      ) : (
        kpi.note && (
          <p className="mt-2 text-[11px] text-[var(--color-ink-3)]">{kpi.note}</p>
        )
      )}
    </div>
  );
}

function KpiGroup({
  group,
  period,
}: {
  group: DashboardData["businessLines"][number]["kpiGroups"][number];
  period: PeriodId;
}) {
  const accent = group.accent || "var(--color-burgundy)";
  return (
    <section className="mb-[22px]" aria-label={group.title}>
      <div className="mb-3 flex items-center gap-3">
        <span
          className="inline-flex size-[26px] shrink-0 items-center justify-center rounded-[8px] text-xs font-bold text-white"
          style={{ background: accent }}
        >
          {group.num}
        </span>
        <h3 className="m-0 text-sm font-bold text-[var(--color-ink)]">
          {group.title}
        </h3>
        {group.subtitle && (
          <span className="text-[11.5px] text-[var(--color-ink-3)]">
            {group.subtitle}
          </span>
        )}
        <span
          className="ml-auto rounded-full border px-2.5 py-[3px] text-[9.5px] font-bold tracking-[0.08em] uppercase"
          style={{ color: accent, borderColor: accent }}
        >
          {group.kpis.length} KPIs
        </span>
      </div>
      <div
        className="weekly-kpi-grid"
        style={{ "--cols": group.cols ?? 4 } as React.CSSProperties}
      >
        {group.kpis.map((kpi) => (
          <KpiTile key={kpi.id} kpi={kpi} period={period} accent={accent} />
        ))}
      </div>
    </section>
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

const RAG_TEXT: Record<string, { fg: string; bg: string }> = {
  green: { fg: "var(--color-rag-green)", bg: "var(--color-rag-green-bg)" },
  amber: { fg: "var(--color-rag-amber)", bg: "var(--color-rag-amber-bg)" },
  red: { fg: "var(--color-rag-red)", bg: "var(--color-rag-red-bg)" },
};

function MiniBar({ pct, color, display }: { pct: number; color?: string; display: string }) {
  const fill = color ?? "var(--color-burgundy)";
  return (
    <span className="inline-flex min-w-[120px] items-center gap-2">
      <span className="h-[5px] w-16 overflow-hidden rounded-[3px] bg-[var(--color-hover-soft)]">
        <span
          className="block h-full rounded-[3px]"
          style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: fill }}
        />
      </span>
      <span className="min-w-[34px] text-right text-[11px]" style={{ color }}>
        {display}
      </span>
    </span>
  );
}

function CellView({ value }: { value: Cell }) {
  if (value === null || value === undefined) return <span>—</span>;
  if (typeof value === "string" || typeof value === "number")
    return <span className="tabular-nums">{value}</span>;

  if ("pct" in value)
    return <MiniBar pct={value.pct} color={value.color} display={`${value.pct}%`} />;

  if ("value" in value && "max" in value) {
    const pct = value.max ? (value.value / value.max) * 100 : 0;
    return (
      <MiniBar
        pct={pct}
        color={value.color}
        display={value.display ?? String(value.value)}
      />
    );
  }
  if ("level" in value) {
    const tone = RAG_TEXT[value.level] ?? RAG_TEXT.amber!;
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-[6px] px-2.5 py-[3px] text-[10px] font-bold tracking-[0.04em] uppercase"
        style={{ color: tone.fg, background: tone.bg }}
      >
        <span
          aria-hidden="true"
          className="size-[5px] rounded-full"
          style={{ background: "currentColor" }}
        />
        {value.label}
      </span>
    );
  }
  // chip
  return (
    <span className="inline-block rounded-[6px] border border-[var(--color-rule)] bg-[var(--color-surface-page)] px-2 py-0.5 text-[10px] font-bold tracking-[0.04em] text-[var(--color-ink-3)]">
      {value.label}
    </span>
  );
}

function WeeklyTable({
  table,
}: {
  table: DashboardData["businessLines"][number]["tables"][number];
}) {
  const isRight = (c: (typeof table.columns)[number]) =>
    c.align === "right" || c.kind === "num" || c.kind === "currency";
  return (
    <div className="rounded-[14px] border border-[var(--color-rule)] bg-[var(--color-surface-card)] p-4 shadow-sm">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <span className="text-[11.5px] font-bold tracking-[0.06em] text-[var(--color-ink-2)] uppercase">
          {table.title}
        </span>
        {table.meta && (
          <span className="text-[10.5px] text-[var(--color-ink-4)]">
            {table.meta}
          </span>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              {table.columns.map((c) => (
                <th
                  key={c.key}
                  className={cn(
                    "border-b border-[var(--color-rule)] px-3 py-[9px] text-[9.5px] font-bold tracking-[0.07em] whitespace-nowrap text-[var(--color-ink-4)] uppercase",
                    isRight(c) ? "text-right" : "text-left",
                  )}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, i) => (
              <tr key={i} className="even:bg-[var(--color-row-alt)] hover:bg-[var(--color-hover-soft)]">
                {table.columns.map((c) => (
                  <td
                    key={c.key}
                    className={cn(
                      "border-b border-[var(--color-rule-soft)] px-3 py-2.5 whitespace-nowrap text-[var(--color-ink-2)]",
                      isRight(c) && "text-right tabular-nums",
                      c.strong && "font-bold text-[var(--color-ink)]",
                    )}
                  >
                    <CellView value={(row[c.key] ?? null) as Cell} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── chart card + section head ────────────────────────────────────────────────

function ChartCard({
  chart,
}: {
  chart: DashboardData["businessLines"][number]["charts"][number];
}) {
  return (
    <div className="flex flex-col rounded-[14px] border border-[var(--color-rule)] bg-[var(--color-surface-card)] px-[18px] pt-4 pb-3.5 shadow-sm">
      <div>
        <h3 className="m-0 text-[11.5px] font-bold tracking-[0.06em] text-[var(--color-ink-2)] uppercase">
          {chart.title}
        </h3>
        {chart.subtitle && (
          <div className="mt-0.5 text-[11px] text-[var(--color-ink-4)]">
            {chart.subtitle}
          </div>
        )}
      </div>
      <div className="mt-2.5">
        <WeeklyChart chart={chart} tall={chart.span === "wide"} />
      </div>
    </div>
  );
}

function SectionHead({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="mt-[26px] mb-3.5 flex items-baseline gap-3 border-b border-[var(--color-rule)] pb-2">
      <span className="text-[9.5px] font-bold tracking-[0.14em] text-[var(--color-ink-4)] uppercase">
        {eyebrow}
      </span>
      <h2 className="m-0 text-sm font-bold text-[var(--color-ink)]">{title}</h2>
    </div>
  );
}

// ── main ─────────────────────────────────────────────────────────────────────

export function WeeklyDashboard({
  data,
}: {
  data: DashboardData;
  // logos kept for API compatibility (resolution is by slug via BrandPlate).
  logos?: Record<string, string>;
}) {
  const [period, setPeriod] = useState<PeriodId>(data.meta.defaultPeriod);
  const [blId, setBlId] = useState(
    data.meta.defaultBl || data.businessLines[0]?.id || "",
  );
  const bl =
    data.businessLines.find((b) => b.id === blId) ?? data.businessLines[0];

  // Charts split: wide → full-row (tall), the rest → 2-up (collapses ≤980px).
  const wides = bl?.charts.filter((c) => c.span === "wide") ?? [];
  const rest = bl?.charts.filter((c) => c.span !== "wide") ?? [];

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--color-rule)] bg-[var(--color-surface-page)] font-[var(--font-sans)] text-[var(--color-ink-2)]">
      {/* Header */}
      <header className="flex min-h-[76px] items-center justify-between gap-5 border-b-[3px] border-[var(--color-burgundy-700)] bg-[var(--color-burgundy)] px-7 text-white">
        <div className="flex min-w-0 items-center gap-4">
          {bl && <BrandPlate slug={bl.id} name={bl.name} />}
          <div className="min-w-0">
            <div className="text-[17px] font-bold tracking-[-0.01em]">
              {data.meta.title || "Weekly dashboard"}
            </div>
            {data.meta.subtitle && (
              <div className="mt-0.5 text-[11px] tracking-[0.02em] text-[#ead3df]">
                {data.meta.subtitle}
              </div>
            )}
          </div>
        </div>
        {data.meta.lastRefreshed && (
          <div className="inline-flex shrink-0 items-center gap-2 rounded-full border border-white/30 px-[13px] py-[5px] text-[11.5px] whitespace-nowrap text-[#f0dce6]">
            <span aria-hidden="true" className="size-[7px] rounded-full bg-[#5fd08c]" />
            Last refreshed&nbsp;
            <strong className="font-bold text-white">
              {data.meta.lastRefreshed}
            </strong>
          </div>
        )}
      </header>

      {/* Toolbar (sticky) */}
      <div className="sticky top-0 z-20 flex flex-wrap items-stretch justify-between gap-4 border-b border-[var(--color-rule)] bg-[var(--color-surface-card)] px-7">
        <div role="tablist" aria-label="Business line" className="flex items-stretch gap-0.5 overflow-x-auto">
          {data.businessLines.map((b) => {
            const isActive = b.id === blId;
            return (
              <button
                key={b.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setBlId(b.id)}
                className={cn(
                  "inline-flex items-center gap-2.5 border-b-[3px] px-4 pt-4 pb-[13px] text-[13px] font-bold whitespace-nowrap transition-colors",
                  isActive
                    ? "text-[var(--color-ink)]"
                    : "border-transparent text-[var(--color-ink-3)] hover:text-[var(--color-ink)]",
                )}
                style={isActive ? { borderBottomColor: b.accent } : undefined}
              >
                <span
                  aria-hidden="true"
                  className="size-[9px] shrink-0 rounded-full"
                  style={{ background: b.accent }}
                />
                {b.name}
                {b.isSample && (
                  <span className="rounded-[6px] bg-[var(--color-rag-amber-bg)] px-1.5 py-0.5 text-[8.5px] font-bold tracking-[0.08em] text-[var(--color-rag-amber)] uppercase">
                    Sample
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[9.5px] font-bold tracking-[0.13em] text-[var(--color-ink-4)] uppercase">
            Period
          </span>
          <div
            role="tablist"
            aria-label="Period"
            className="my-[9px] inline-flex gap-0.5 rounded-[10px] border border-[var(--color-rule)] bg-[var(--color-surface-page)] p-[3px]"
          >
            {data.meta.periods.map((p) => (
              <button
                key={p.id}
                type="button"
                role="tab"
                aria-selected={period === p.id}
                onClick={() => setPeriod(p.id)}
                className={cn(
                  "rounded-[7px] px-[13px] py-1.5 text-xs transition-colors",
                  period === p.id
                    ? "bg-[var(--color-surface-card)] font-bold text-[var(--color-ink)] shadow-sm"
                    : "font-medium text-[var(--color-ink-3)] hover:text-[var(--color-ink)]",
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Body */}
      <main className="mx-auto max-w-[1440px] px-7 pt-[22px] pb-10">
        {bl && (
          <>
            <div className="mb-[18px] flex flex-wrap items-baseline gap-3.5">
              <h1 className="m-0 text-[19px] font-bold tracking-[-0.01em] text-[var(--color-ink)]">
                {bl.name}
              </h1>
              {bl.tagline && (
                <span className="text-[12.5px] text-[var(--color-ink-3)]">
                  {bl.tagline}
                </span>
              )}
              {bl.isSample && (
                <span className="rounded-[6px] border border-[#e8d49c] bg-[var(--color-rag-amber-bg)] px-2 py-[3px] text-[9px] font-bold tracking-[0.08em] text-[var(--color-rag-amber)] uppercase">
                  Sample / illustrative data
                </span>
              )}
            </div>

            {bl.kpiGroups.map((group) => (
              <KpiGroup key={group.title} group={group} period={period} />
            ))}

            {bl.charts.length > 0 && (
              <>
                <SectionHead eyebrow="Analysis" title="Charts" />
                <div className="space-y-3.5">
                  {wides.map((c) => (
                    <ChartCard key={c.id} chart={c} />
                  ))}
                  {rest.length > 0 && (
                    <div
                      className={cn(
                        "grid gap-3.5",
                        rest.length > 1 && "min-[981px]:grid-cols-2",
                      )}
                    >
                      {rest.map((c) => (
                        <ChartCard key={c.id} chart={c} />
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            {bl.tables.length > 0 && (
              <>
                <SectionHead eyebrow="Detail" title="Tables" />
                <div className="space-y-3.5">
                  {bl.tables.map((table) => (
                    <WeeklyTable key={table.id} table={table} />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </main>

      {/* Footer */}
      {(data.meta.footLeft || data.meta.footRight) && (
        <div className="mx-auto flex max-w-[1440px] flex-wrap justify-between gap-4 px-7 pb-7 text-[10.5px] tracking-[0.03em] text-[var(--color-ink-4)]">
          <span>{data.meta.footLeft}</span>
          <span>{data.meta.footRight}</span>
        </div>
      )}
    </div>
  );
}
