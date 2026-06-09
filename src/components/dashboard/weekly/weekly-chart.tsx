"use client";

import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { DashboardChart } from "@/lib/validations/dashboard";
import { fmtValue } from "@/lib/dashboard/format";

const AXIS = { fontSize: 12, fill: "var(--color-fg-muted)" };

export function WeeklyChart({ chart }: { chart: DashboardChart }) {
  const fmt = (v: number) => fmtValue(v, chart.valueKind);
  // Value label printed just above each bar (outside-end) — legible on the card
  // surface regardless of bar colour. Tooltips are kept alongside.
  const barLabel = (v: unknown) => fmt(Number(v));

  if (chart.type === "groupedBar") {
    // Reshape categories × series → one row per category.
    const rows = chart.categories.map((category, i) => {
      const row: Record<string, string | number> = { category };
      for (const s of chart.series) row[s.name] = s.data[i] ?? 0;
      return row;
    });
    return (
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <XAxis
            dataKey="category"
            tick={AXIS}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={AXIS}
            tickLine={false}
            axisLine={false}
            width={48}
            tickFormatter={(v) => fmt(Number(v))}
          />
          <Tooltip
            formatter={(v) => fmt(Number(v))}
            contentStyle={{
              borderRadius: 8,
              border: "1px solid var(--color-border)",
              fontSize: 12,
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {chart.series.map((s) => (
            <Bar
              key={s.name}
              dataKey={s.name}
              fill={s.color}
              radius={[4, 4, 0, 0]}
            >
              <LabelList
                dataKey={s.name}
                position="top"
                formatter={barLabel}
                fill="var(--color-fg-muted)"
                fontSize={11}
              />
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    );
  }

  if (chart.type === "doughnut") {
    return (
      <ResponsiveContainer width="100%" height={260}>
        <PieChart>
          <Tooltip formatter={(v) => fmt(Number(v))} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Pie
            data={chart.segments}
            dataKey="value"
            nameKey="label"
            innerRadius="62%"
            outerRadius="90%"
            paddingAngle={1}
            strokeWidth={2}
          >
            {chart.segments.map((s) => (
              <Cell key={s.label} fill={s.color} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    );
  }

  // bar (single series, per-point colour)
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart
        data={chart.segments}
        margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
      >
        <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} />
        <YAxis
          tick={AXIS}
          tickLine={false}
          axisLine={false}
          width={48}
          tickFormatter={(v) => fmt(Number(v))}
        />
        <Tooltip formatter={(v) => fmt(Number(v))} />
        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
          <LabelList
            dataKey="value"
            position="top"
            formatter={barLabel}
            fill="var(--color-fg-muted)"
            fontSize={11}
          />
          {chart.segments.map((s) => (
            <Cell key={s.label} fill={s.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
