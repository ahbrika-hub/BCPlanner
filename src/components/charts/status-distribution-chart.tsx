"use client";

import { Pie, PieChart, Cell } from "recharts";

import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { EmptyState } from "@/components/ui/empty-state";

export type StatusDatum = { status: string; count: number };

const RAD = Math.PI / 180;

// Resolve a CSS custom property to its value (client only), cached per name.
const colorCache = new Map<string, string>();
function resolveVar(name: string): string {
  const hit = colorCache.get(name);
  if (hit !== undefined) return hit;
  const v =
    typeof document !== "undefined"
      ? getComputedStyle(document.documentElement)
          .getPropertyValue(name)
          .trim()
      : "";
  colorCache.set(name, v);
  return v;
}

function relativeLuminance(hex: string): number {
  const m = hex.replace("#", "");
  if (m.length < 6) return 0;
  const ch = (i: number) => parseInt(m.slice(i, i + 2), 16) / 255;
  const lin = (c: number) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  return 0.2126 * lin(ch(0)) + 0.7152 * lin(ch(2)) + 0.0722 * lin(ch(4));
}

// Contrast-safe label fill for a status segment: light text on dark fills,
// dark text on light fills (all current status tokens are dark → white).
function labelFill(status: string): string {
  const bg = resolveVar(`--color-status-${status}`);
  return bg.startsWith("#") && relativeLuminance(bg) > 0.5
    ? "#111827"
    : "#ffffff";
}

// Recharts passes label render props loosely typed (fields may be undefined).
type PieLabelProps = {
  cx?: number;
  cy?: number;
  midAngle?: number;
  innerRadius?: number;
  outerRadius?: number;
  percent?: number;
  value?: number;
  name?: string | number;
};

/**
 * Builds an in-segment value-label renderer. `fontSizePx` pins a constant font
 * size (used by the report variant so labels don't appear to rescale); when
 * omitted the label keeps the dashboard's original `text-[11px]` class so the
 * dashboard donut renders exactly as before. Slices too small are skipped.
 */
function makeSegmentLabel(fontSizePx?: number) {
  return function SegmentLabel(props: PieLabelProps) {
    const cx = props.cx ?? 0;
    const cy = props.cy ?? 0;
    const midAngle = props.midAngle ?? 0;
    const innerRadius = props.innerRadius ?? 0;
    const outerRadius = props.outerRadius ?? 0;
    const percent = props.percent ?? 0;
    const value = props.value ?? 0;
    if (percent < 0.04) return null; // too small to fit a legible label
    const r = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + r * Math.cos(-midAngle * RAD);
    const y = cy + r * Math.sin(-midAngle * RAD);
    return (
      <text
        x={x}
        y={y}
        fill={labelFill(String(props.name ?? ""))}
        textAnchor="middle"
        dominantBaseline="central"
        className={fontSizePx ? "font-semibold" : "text-[11px] font-semibold"}
        fontSize={fontSizePx}
        style={{ pointerEvents: "none" }}
      >
        {value}
        {percent >= 0.1 ? ` · ${Math.round(percent * 100)}%` : ""}
      </text>
    );
  };
}

// Dashboard donut keeps its original 11px label; the report variant uses a
// smaller, explicitly-fixed 10px label.
const defaultSegmentLabel = makeSegmentLabel();
const reportSegmentLabel = makeSegmentLabel(10);

export function StatusDistributionChart({
  data,
  onSegmentClick,
  variant = "donut",
}: {
  data: StatusDatum[];
  /** Optional drill-down: fires with the clicked segment's status. */
  onSegmentClick?: (status: string) => void;
  /**
   * "donut" (default) — the dashboard appearance (auto-fit radius, 11px label).
   * "report" — a thicker arc with FIXED inner/outer radius so the band and label
   * positions don't change when filters change the status count, and a constant
   * 10px label. Scopes the Reports tweaks without altering the dashboard.
   */
  variant?: "donut" | "report";
}) {
  if (data.length === 0) {
    return <EmptyState title="No data" description="No tasks to chart yet." />;
  }

  const isReport = variant === "report";
  // Report: both radii fixed → constant band thickness + stable label radius
  // across filter changes. Dashboard: original auto-fit outerRadius (unchanged).
  const innerRadius = isReport ? 62 : 55;
  const outerRadius = isReport ? 98 : undefined;
  const segmentLabel = isReport ? reportSegmentLabel : defaultSegmentLabel;

  const config: ChartConfig = Object.fromEntries(
    data.map((d) => [
      d.status,
      {
        label: d.status.replace(/_/g, " "),
        color: `var(--color-status-${d.status})`,
      },
    ]),
  );

  return (
    <ChartContainer
      config={config}
      className="mx-auto aspect-square max-h-72 w-full"
    >
      <PieChart>
        <ChartTooltip content={<ChartTooltipContent nameKey="status" />} />
        <Pie
          data={data}
          dataKey="count"
          nameKey="status"
          innerRadius={innerRadius}
          outerRadius={outerRadius}
          strokeWidth={2}
          label={segmentLabel}
          labelLine={false}
          onClick={
            onSegmentClick
              ? (entry: { status?: string; payload?: { status?: string } }) =>
                  onSegmentClick(entry?.status ?? entry?.payload?.status ?? "")
              : undefined
          }
          className={onSegmentClick ? "cursor-pointer outline-none" : undefined}
        >
          {data.map((d) => (
            <Cell key={d.status} fill={`var(--color-status-${d.status})`} />
          ))}
        </Pie>
        {/* Legend maps colour → status label so the donut isn't colour-only. */}
        <ChartLegend
          content={<ChartLegendContent nameKey="status" />}
          className="flex-wrap"
        />
      </PieChart>
    </ChartContainer>
  );
}
