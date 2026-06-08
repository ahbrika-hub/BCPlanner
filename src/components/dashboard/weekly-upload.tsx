"use client";

import { useRef, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

import { uploadWeeklyDashboard } from "@/lib/actions/dashboard";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

/**
 * Weekly-dashboard upload control, shown on the dashboard-upload task's detail
 * page for the assignee. Accepts one .xlsx; the server parses, validates, and
 * stores a snapshot, then revalidates the weekly dashboard.
 */
export function WeeklyDashboardUpload({ taskId }: { taskId: string }) {
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function onSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    const fd = new FormData();
    fd.set("file", file);
    fd.set("taskId", taskId);
    const res = await uploadWeeklyDashboard(fd);
    setBusy(false);
    if (inputRef.current) inputRef.current.value = "";
    if (res.ok) {
      toast.success(`Weekly dashboard updated (week of ${res.weekStart}).`);
    } else {
      toast.error(res.error);
    }
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Upload className="text-primary size-4" aria-hidden="true" />
          Weekly dashboard upload
        </CardTitle>
        <CardDescription>
          Upload this week&apos;s dashboard workbook (.xlsx). It updates the
          weekly dashboard for everyone.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-3">
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="hidden"
          onChange={onSelect}
          aria-label="Weekly dashboard workbook"
        />
        <Button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Upload className="size-4" />
          )}
          {busy ? "Processing…" : "Choose .xlsx"}
        </Button>
        <span className="text-fg-muted text-xs">Max 5MB · .xlsx only</span>
      </CardContent>
    </Card>
  );
}
