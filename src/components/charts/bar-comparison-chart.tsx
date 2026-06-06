"use client";

import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";

import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { EmptyState } from "@/components/ui/empty-state";

export type BarDatum = { label: string; count: number };

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
    <ChartContainer config={config} className="max-h-64 w-full">
      <BarChart data={data} margin={{ left: 4, right: 4 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="count" fill="var(--color-count)" radius={4} />
      </BarChart>
    </ChartContainer>
  );
}
