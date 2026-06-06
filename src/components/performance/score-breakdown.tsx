import { Progress } from "@/components/ui/progress";

/**
 * Transparent 40/30/30 score breakdown so the overall is explainable.
 */
export function ScoreBreakdown({
  assigned,
  completed,
  delayed,
  quality,
  overall,
}: {
  assigned: number;
  completed: number;
  delayed: number;
  quality: number | null;
  overall: number;
}) {
  const completionPart = assigned > 0 ? (completed / assigned) * 40 : 0;
  const qualityPart = ((quality ?? 0) / 5) * 30;
  const delayPart = assigned > 0 ? (1 - delayed / assigned) * 30 : 0;

  const rows = [
    {
      label: "Completion",
      detail: `${completed}/${assigned} × 40`,
      value: completionPart,
      max: 40,
    },
    {
      label: "Quality",
      detail: `${quality ?? 0}/5 × 30`,
      value: qualityPart,
      max: 30,
    },
    {
      label: "Timeliness",
      detail: `(1 − ${delayed}/${assigned}) × 30`,
      value: delayPart,
      max: 30,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-baseline gap-2">
        <span className="text-primary text-4xl font-semibold">{overall}</span>
        <span className="text-muted-foreground text-sm">/ 100</span>
      </div>
      <div className="space-y-3">
        {rows.map((r) => (
          <div key={r.label}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="font-medium">{r.label}</span>
              <span className="text-muted-foreground">
                {r.detail} = {Math.round(r.value * 10) / 10}
              </span>
            </div>
            <Progress value={(r.value / r.max) * 100} />
          </div>
        ))}
      </div>
    </div>
  );
}
