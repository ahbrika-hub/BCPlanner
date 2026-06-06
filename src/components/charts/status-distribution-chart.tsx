"use client";

import { Pie, PieChart, Cell } from "recharts";

import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { EmptyState } from "@/components/ui/empty-state";

export type StatusDatum = { status: string; count: number };

export function StatusDistributionChart({ data }: { data: StatusDatum[] }) {
  if (data.length === 0) {
    return <EmptyState title="No data" description="No tasks to chart yet." />;
  }

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
    <ChartContainer config={config} className="mx-auto aspect-square max-h-64">
      <PieChart>
        <ChartTooltip content={<ChartTooltipContent nameKey="status" />} />
        <Pie
          data={data}
          dataKey="count"
          nameKey="status"
          innerRadius={55}
          strokeWidth={2}
        >
          {data.map((d) => (
            <Cell key={d.status} fill={`var(--color-status-${d.status})`} />
          ))}
        </Pie>
      </PieChart>
    </ChartContainer>
  );
}
