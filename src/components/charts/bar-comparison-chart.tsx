"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  XAxis,
  YAxis,
} from "recharts";

import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { EmptyState } from "@/components/ui/empty-state";

export type BarDatum = { label: string; count: number };

/**
 * Horizontal bar comparison — categories on the Y axis (room for long labels),
 * value on the X axis, with the count printed at the end of each bar so it reads
 * without relying on colour or the tooltip.
 */
export function BarComparisonChart({
  data,
  color = "var(--primary)",
}: {
  data: BarDatum[];
  color?: string;
}) {
  if (data.length === 0) {
    return <EmptyState title="No data" description="Nothing to compare yet." />;
  }

  const config: ChartConfig = { count: { label: "Tasks", color } };

  return (
    <ChartContainer config={config} className="max-h-72 w-full">
      <BarChart
        accessibilityLayer
        data={data}
        layout="vertical"
        margin={{ left: 4, right: 24 }}
      >
        <CartesianGrid horizontal={false} />
        <XAxis type="number" allowDecimals={false} hide />
        <YAxis
          dataKey="label"
          type="category"
          tickLine={false}
          axisLine={false}
          width={120}
          tickMargin={8}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="count" fill="var(--color-count)" radius={4}>
          <LabelList
            dataKey="count"
            position="right"
            className="fill-fg-muted text-xs"
          />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}
