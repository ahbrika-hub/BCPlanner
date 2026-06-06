"use client";

import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";

import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { EmptyState } from "@/components/ui/empty-state";

export type TrendDatum = { label: string; completed: number; created: number };

const config: ChartConfig = {
  created: { label: "Created", color: "var(--secondary)" },
  completed: { label: "Completed", color: "var(--primary)" },
};

export function TasksOverTimeChart({ data }: { data: TrendDatum[] }) {
  if (data.length === 0) {
    return <EmptyState title="No data" description="No trend to display." />;
  }

  return (
    <ChartContainer config={config} className="max-h-64 w-full">
      <AreaChart data={data} margin={{ left: 4, right: 4 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Area
          dataKey="created"
          type="monotone"
          fill="var(--color-created)"
          fillOpacity={0.15}
          stroke="var(--color-created)"
        />
        <Area
          dataKey="completed"
          type="monotone"
          fill="var(--color-completed)"
          fillOpacity={0.2}
          stroke="var(--color-completed)"
        />
      </AreaChart>
    </ChartContainer>
  );
}
