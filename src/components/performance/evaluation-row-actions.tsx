"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { deleteEvaluationAction } from "@/lib/actions/performance";
import { Button } from "@/components/ui/button";

/**
 * Per-row Remove control for a Team Performance evaluation. Rendered only for
 * users who can evaluate (admin/section_head); the delete is additionally
 * enforced by RLS. Confirms before deleting and refreshes the list on success.
 */
export function EvaluationRowActions({
  id,
  employeeName,
  period,
}: {
  id: string;
  employeeName: string;
  period: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const onRemove = () => {
    if (pending) return;
    if (
      !window.confirm(
        `Remove the ${period} evaluation for ${employeeName}? This can't be undone.`,
      )
    )
      return;
    startTransition(async () => {
      const res = await deleteEvaluationAction(id);
      if (res.ok) {
        toast.success("Evaluation removed");
        router.refresh();
      } else {
        toast.error(res.error ?? "Could not remove evaluation.");
      }
    });
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-8"
      disabled={pending}
      onClick={onRemove}
      aria-label={`Remove ${period} evaluation for ${employeeName}`}
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Trash2 className="text-danger size-4" />
      )}
    </Button>
  );
}
