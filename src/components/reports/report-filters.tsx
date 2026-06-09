"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { X } from "lucide-react";

import type { BusinessLineRow, AssignableUser } from "@/lib/data/types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const STATUSES = [
  "draft",
  "pending_approval",
  "approved",
  "assigned",
  "in_progress",
  "pending_update",
  "pending_review",
  "completed",
  "rejected",
  "returned_for_modification",
  "cancelled",
  "reopened",
];

export function ReportFilters({
  businessLines,
  assignees,
}: {
  businessLines: BusinessLineRow[];
  assignees: AssignableUser[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params.toString());
    if (value && value !== "all") next.set(key, value);
    else next.delete(key);
    router.push(`${pathname}?${next.toString()}`);
  };

  const hasFilters = ["from", "to", "business_line", "assignee", "status"].some(
    (k) => params.get(k),
  );

  return (
    <div className="mb-6 flex flex-wrap items-end gap-3">
      <div className="space-y-1">
        <Label htmlFor="from" className="text-xs">
          From
        </Label>
        <Input
          id="from"
          type="date"
          className="w-40"
          defaultValue={params.get("from") ?? ""}
          onChange={(e) => setParam("from", e.target.value)}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="to" className="text-xs">
          To
        </Label>
        <Input
          id="to"
          type="date"
          className="w-40"
          defaultValue={params.get("to") ?? ""}
          onChange={(e) => setParam("to", e.target.value)}
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Business line</Label>
        <Select
          value={params.get("business_line") ?? "all"}
          onValueChange={(v) => setParam("business_line", v)}
        >
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All lines</SelectItem>
            {businessLines.map((bl) => (
              <SelectItem key={bl.id} value={bl.id}>
                {bl.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Assignee</Label>
        <Select
          value={params.get("assignee") ?? "all"}
          onValueChange={(v) => setParam("assignee", v)}
        >
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All assignees</SelectItem>
            {assignees.map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.full_name || u.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Status</Label>
        <Select
          value={params.get("status") ?? "all"}
          onValueChange={(v) => setParam("status", v)}
        >
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s.replace(/_/g, " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={() => router.push(pathname)}>
          <X className="size-4" />
          Clear
        </Button>
      )}
    </div>
  );
}
