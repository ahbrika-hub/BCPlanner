"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { DashboardChart } from "@/lib/validations/dashboard";
import { fmtNum, moneyShort } from "@/lib/dashboard/format";

const TICK = { fontSize: 11, fill: "var(--color-ink-4)" };
const GRID = "color-mix(in srgb, var(--color-ink-3) 12%, transparent)";
const TOOLTIP_STYLE = {
  borderRadius: 8,
  border: "1px solid var(--color-rule)",
  fontSize: 12,
  color: "var(--color-ink-2)",
} as const;

type LegendItem = { label: string; color: string };

function ChartLegend({ items }: { items: LegendItem[] }) {
  if (items.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-3">
      {items.map((it) => (
        <span
          key={it.label}
          className="inline-flex items-center gap-1.5 text-[11px] text-[var(--color-ink-3)]"
        >
          <span
            className="size-[9px] shrink-0 rounded-[2px]"
            style={{ background: it.color }}
            aria-hidden="true"
          />
          {it.label}
        </span>
      ))}
    </div>
  );
}

/**
 * Weekly-dashboard chart, ported from the design's Chart.js config to Recharts
 * per the migration package §3: line → LineChart/Line; doughnut → Pie
 * innerRadius 62% + Cell; groupedBar → BarChart with one Bar per series (the
 * categories×series reshape); bar → Bar + per-point Cell. Legends are rendered
 * as HTML below the plot (matching the design), not via Recharts <Legend>.
 */
export function WeeklyChart({
  chart,
  tall = false,
}: {
  chart: DashboardChart;
  tall?: boolean;
}) {
  const height = tall ? 280 : 230;
  const currency = chart.valueKind === "currency";
  // Tooltip shows the full number (SAR-prefixed for currency); the y-axis uses
  // the compact form — matching the design's fmtVal vs moneyShort split.
  const tip = (v: number) => (currency ? `SAR ${fmtNum(v)}` : fmtNum(v));
  const yTick = (v: number) => (currency ? moneyShort(Number(v)) : fmtNum(Number(v)));

  if (chart.type === "groupedBar" || chart.type === "line") {
    // Reshape categories × series → one row per category.
    const rows = chart.categories.map((category, i) => {
      const row: Record<string, string | number> = { category };
      for (const s of chart.series) row[s.name] = s.data[i] ?? 0;
      return row;
    });
    const legend = chart.series.map((s) => ({ label: s.name, color: s.color }));

    return (
      <>
        <ResponsiveContainer width="100%" height={height}>
          {chart.type === "line" ? (
            <LineChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke={GRID} />
              <XAxis dataKey="category" tick={TICK} tickLine={false} axisLine={false} />
              <YAxis tick={TICK} tickLine={false} axisLine={false} width={48} tickFormatter={yTick} />
              <Tooltip formatter={(v) => tip(Number(v))} contentStyle={TOOLTIP_STYLE} />
              {chart.series.map((s) => (
                <Line
                  key={s.name}
                  type="monotone"
                  dataKey={s.name}
                  stroke={s.color}
                  strokeWidth={2}
                  dot={{ r: 3, fill: s.color }}
                  activeDot={{ r: 5 }}
                />
              ))}
            </LineChart>
          ) : (
            <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke={GRID} />
              <XAxis dataKey="category" tick={TICK} tickLine={false} axisLine={false} />
              <YAxis tick={TICK} tickLine={false} axisLine={false} width={48} tickFormatter={yTick} />
              <Tooltip formatter={(v) => tip(Number(v))} contentStyle={TOOLTIP_STYLE} cursor={{ fill: "var(--color-hover-soft)" }} />
              {chart.series.map((s) => (
                <Bar key={s.name} dataKey={s.name} fill={s.color} radius={[4, 4, 0, 0]} />
              ))}
            </BarChart>
          )}
        </ResponsiveContainer>
        <ChartLegend items={legend} />
      </>
    );
  }

  if (chart.type === "doughnut") {
    const total = chart.segments.reduce((a, s) => a + s.value, 0) || 1;
    const legend = chart.segments.map((s) => ({
      label: `${s.label} · ${((s.value / total) * 100).toFixed(1)}%`,
      color: s.color,
    }));
    return (
      <>
        <ResponsiveContainer width="100%" height={height}>
          <PieChart>
            <Tooltip
              formatter={(v) => tip(Number(v))}
              contentStyle={TOOLTIP_STYLE}
            />
            <Pie
              data={chart.segments}
              dataKey="value"
              nameKey="label"
              innerRadius="62%"
              outerRadius="90%"
              paddingAngle={1}
              stroke="var(--color-surface-card)"
              strokeWidth={2}
            >
              {chart.segments.map((s) => (
                <Cell key={s.label} fill={s.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <ChartLegend items={legend} />
      </>
    );
  }

  // single bar — per-point colour
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={chart.segments} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey="label" tick={TICK} tickLine={false} axisLine={false} />
        <YAxis tick={TICK} tickLine={false} axisLine={false} width={48} tickFormatter={yTick} />
        <Tooltip formatter={(v) => tip(Number(v))} contentStyle={TOOLTIP_STYLE} cursor={{ fill: "var(--color-hover-soft)" }} />
        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
          {chart.segments.map((s) => (
            <Cell key={s.label} fill={s.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
