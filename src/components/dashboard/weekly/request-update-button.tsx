"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Loader2, Clock } from "lucide-react";
import { toast } from "sonner";

import { requestDashboardUpdateAction } from "@/lib/actions/dashboard-request";
import type { AssignableUser } from "@/lib/data/types";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * "Request update" — shown only to dashboard.request_update holders
 * (admin/section_head/ceo). Disabled with an "Update in progress" badge while a
 * Dashboard Update task is open. One click usually suffices (assigned to the
 * configured dashboard owner); if none is configured the action returns
 * `no_assignee` and we prompt for an assignee.
 */
export function RequestUpdateButton({
  canRequest,
  inProgress,
  users,
}: {
  canRequest: boolean;
  inProgress: boolean;
  users: AssignableUser[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [assigneeId, setAssigneeId] = useState("");

  if (!canRequest) return null;

  if (inProgress) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-warning inline-flex items-center gap-1.5 text-xs font-medium">
          <Clock className="size-3.5" />
          Update in progress
        </span>
        <Button variant="outline" size="sm" disabled>
          <RefreshCw className="size-4" />
          Request update
        </Button>
      </div>
    );
  }

  const run = (assignee?: string) =>
    startTransition(async () => {
      const res = await requestDashboardUpdateAction(assignee);
      if (res.ok) {
        toast.success("Update requested — the assignee has been notified.");
        setPickerOpen(false);
        router.refresh();
      } else if (res.error === "no_assignee") {
        // No dashboard owner configured — ask the requester to pick one.
        setPickerOpen(true);
      } else {
        toast.error(res.error);
      }
    });

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => run()}
        disabled={pending}
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <RefreshCw className="size-4" />
        )}
        Request update
      </Button>

      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign the dashboard update</DialogTitle>
            <DialogDescription>
              No dashboard owner is configured. Choose who should prepare this
              week&rsquo;s update.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Assignee</Label>
            <Select value={assigneeId} onValueChange={setAssigneeId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a user" />
              </SelectTrigger>
              <SelectContent>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.full_name || u.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button
              onClick={() => run(assigneeId)}
              disabled={pending || !assigneeId}
            >
              {pending && <Loader2 className="size-4 animate-spin" />}
              Request update
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
