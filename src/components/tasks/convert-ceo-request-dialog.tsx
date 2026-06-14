"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Wand2 } from "lucide-react";
import { toast } from "sonner";

import { convertCeoRequestAction } from "@/lib/actions/tasks";
import type { AssignableUser, BusinessLineRow, TaskPriority } from "@/lib/data/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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

const PRIORITIES: TaskPriority[] = ["low", "medium", "high", "critical"];

/**
 * Manager conversion of a CEO request: set priority / business line / due date /
 * assignee, then approve + assign in one step (convertCeoRequestAction composes
 * the existing single-task actions). Produces a normal assigned task.
 */
export function ConvertCeoRequestDialog({
  taskId,
  title,
  businessLines,
  users,
}: {
  taskId: string;
  title: string;
  businessLines: BusinessLineRow[];
  users: AssignableUser[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [taskTitle, setTaskTitle] = useState(title);
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [businessLineId, setBusinessLineId] = useState<string>("");
  const [dueDate, setDueDate] = useState<string>("");
  const [assigneeId, setAssigneeId] = useState<string>("");

  const submit = () => {
    startTransition(async () => {
      const res = await convertCeoRequestAction(taskId, {
        title: taskTitle.trim(),
        priority,
        business_line_id: businessLineId || undefined,
        due_date: dueDate || undefined,
        assignee_id: assigneeId,
      });
      if (res.ok) {
        toast.success("CEO request assigned");
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
        <Button size="sm" variant="secondary">
          <Wand2 className="size-4" />
          Convert &amp; assign
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Convert CEO request</DialogTitle>
          <DialogDescription>
            Set the details and assign. This approves and assigns the task in one
            step.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="convert-title">Title</Label>
            <Input
              id="convert-title"
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select
                value={priority}
                onValueChange={(v) => setPriority(v as TaskPriority)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="convert-due">Due date</Label>
              <Input
                id="convert-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Business line</Label>
            <Select value={businessLineId} onValueChange={setBusinessLineId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a business line" />
              </SelectTrigger>
              <SelectContent>
                {businessLines.map((bl) => (
                  <SelectItem key={bl.id} value={bl.id}>
                    {bl.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Assignee</Label>
            <Select value={assigneeId} onValueChange={setAssigneeId}>
              <SelectTrigger>
                <SelectValue placeholder="Select an assignee" />
              </SelectTrigger>
              <SelectContent>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.full_name} ({u.role})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button
            onClick={submit}
            disabled={pending || taskTitle.trim().length < 3 || !assigneeId}
          >
            {pending && <Loader2 className="size-4 animate-spin" />}
            Approve &amp; assign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
