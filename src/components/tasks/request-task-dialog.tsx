"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { requestTaskAction } from "@/lib/actions/tasks";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/**
 * CEO lightweight task request: one line in, a pending_approval (unassigned)
 * task out, for a section_head/admin to refine + assign. Deliberately minimal —
 * no priority/business-line/assignee pickers; those are set on conversion.
 */
export function RequestTaskDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [pending, startTransition] = useTransition();

  const submit = () => {
    startTransition(async () => {
      const res = await requestTaskAction(description);
      if (res.ok) {
        toast.success("Request submitted for approval");
        setDescription("");
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
          Request a task
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Request a task</DialogTitle>
          <DialogDescription>
            Describe what you need in one line. It goes to a section head / admin
            to prioritise, assign, and approve.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="ceo-request">What do you need done?</Label>
          <Textarea
            id="ceo-request"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Prepare a Q3 fleet utilisation summary for the board"
          />
        </div>
        <DialogFooter>
          <Button
            onClick={submit}
            disabled={pending || description.trim().length < 3}
          >
            {pending && <Loader2 className="size-4 animate-spin" />}
            Submit request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
