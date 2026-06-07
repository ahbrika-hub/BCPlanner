"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import type { z } from "zod";

import { createEvaluationSchema } from "@/lib/validations";
import {
  createEvaluationAction,
  previewMetricsAction,
} from "@/lib/actions/performance";
import type { ComputedMetrics } from "@/lib/data/performance";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScoreBreakdown } from "@/components/performance/score-breakdown";

type FormValues = z.infer<typeof createEvaluationSchema>;

export function EvaluationForm({
  employees,
  periods,
}: {
  employees: { id: string; full_name: string }[];
  periods: string[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [metrics, setMetrics] = useState<ComputedMetrics | null>(null);
  const router = useRouter();

  const { handleSubmit, setValue, getValues, register, reset } =
    useForm<FormValues>({
      resolver: zodResolver(createEvaluationSchema),
      defaultValues: { period: periods[0] },
    });

  const compute = () => {
    const { employee_id: employeeId, period } = getValues();
    if (!employeeId || !period) {
      toast.error("Select an employee and period first.");
      return;
    }
    startTransition(async () => {
      const res = await previewMetricsAction(employeeId, period);
      if (res.ok && res.metrics) setMetrics(res.metrics);
      else toast.error(res.error ?? "Could not compute metrics");
    });
  };

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      const res = await createEvaluationAction(values);
      if (res.ok) {
        toast.success("Evaluation saved");
        reset({ period: periods[0] });
        setMetrics(null);
        setOpen(false);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" />
          New Evaluation
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New Evaluation</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Employee</Label>
              <Select onValueChange={(v) => setValue("employee_id", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select…" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Period</Label>
              <Select
                defaultValue={periods[0]}
                onValueChange={(v) => setValue("period", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {periods.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={compute}
            disabled={pending}
          >
            {pending && <Loader2 className="size-4 animate-spin" />}
            Compute metrics
          </Button>

          {metrics && (
            <div className="rounded-md border p-3">
              <ScoreBreakdown
                assigned={metrics.assigned_tasks_count}
                completed={metrics.completed_tasks_count}
                delayed={metrics.delayed_tasks_count}
                quality={metrics.quality_avg_rating}
                overall={metrics.overall_score}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" rows={3} {...register("evaluation_notes")} />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              Save Evaluation
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
