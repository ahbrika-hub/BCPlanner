"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const PRESETS: { value: string; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
  { value: "custom", label: "Custom range" },
];

/**
 * Period selector for the Workload view. State lives in the URL (useSearchParams
 * — nuqs is deferred), so the server re-computes the aggregation for the range.
 */
export function WorkloadPeriodFilter({
  preset,
  from,
  to,
}: {
  preset: string;
  from: string;
  to: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const update = (next: URLSearchParams) =>
    router.push(`${pathname}?${next.toString()}`);

  const onPreset = (value: string) => {
    const next = new URLSearchParams(params.toString());
    next.set("period", value);
    if (value !== "custom") {
      next.delete("from");
      next.delete("to");
    } else {
      // seed custom inputs with the currently-resolved range
      next.set("from", from);
      next.set("to", to);
    }
    update(next);
  };

  const onDate = (key: "from" | "to", value: string) => {
    const next = new URLSearchParams(params.toString());
    next.set("period", "custom");
    if (value) next.set(key, value);
    else next.delete(key);
    update(next);
  };

  return (
    <div className="mb-6 flex flex-wrap items-end gap-3">
      <div className="space-y-1">
        <Label className="text-xs">Period</Label>
        <Select value={preset} onValueChange={onPreset}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PRESETS.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {preset === "custom" && (
        <>
          <div className="space-y-1">
            <Label htmlFor="wl-from" className="text-xs">
              From
            </Label>
            <Input
              id="wl-from"
              type="date"
              value={from}
              onChange={(e) => onDate("from", e.target.value)}
              className="w-40"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="wl-to" className="text-xs">
              To
            </Label>
            <Input
              id="wl-to"
              type="date"
              value={to}
              onChange={(e) => onDate("to", e.target.value)}
              className="w-40"
            />
          </div>
        </>
      )}
    </div>
  );
}
