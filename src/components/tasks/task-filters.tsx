"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Search, X, AlertTriangle, ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { TASK_STATUSES, TASK_STATUS_LABELS } from "@/lib/tasks/status";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// URL-persisted server filters: full-text search (q), multi-status, derived
// overdue toggle, and priority. Changing any of these re-runs the server fetch
// (listTasks). Assignee / business-line / sort live in TasksTable (client-side,
// also URL-persisted). A change here pushes a new URL; the shared params mean
// every control round-trips through the address bar.
export function TaskFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const pushParams = (next: URLSearchParams) => {
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params.toString());
    if (value && value !== "all") next.set(key, value);
    else next.delete(key);
    pushParams(next);
  };

  const selectedStatuses = (params.get("status") ?? "")
    .split(",")
    .filter(Boolean);

  const toggleStatus = (status: string, checked: boolean) => {
    const set = new Set(selectedStatuses);
    if (checked) set.add(status);
    else set.delete(status);
    const next = new URLSearchParams(params.toString());
    if (set.size > 0) next.set("status", [...set].join(","));
    else next.delete("status");
    pushParams(next);
  };

  const overdue = params.get("overdue") === "1";
  const toggleOverdue = () => setParam("overdue", overdue ? null : "1");

  const hasFilters = ["status", "priority", "q", "overdue"].some((k) =>
    params.get(k),
  );

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <div className="relative">
        <Search className="text-muted-foreground absolute top-2.5 left-2.5 size-4" />
        <Input
          placeholder="Search title, task no, or description…"
          defaultValue={params.get("q") ?? ""}
          className="w-64 pl-8"
          onKeyDown={(e) => {
            if (e.key === "Enter")
              setParam("q", (e.target as HTMLInputElement).value.trim());
          }}
        />
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="min-w-40 justify-between">
            {selectedStatuses.length > 0
              ? `${selectedStatuses.length} status${selectedStatuses.length > 1 ? "es" : ""}`
              : "All statuses"}
            <ChevronDown className="size-4 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-h-80 overflow-y-auto">
          <DropdownMenuLabel>Filter by status</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {TASK_STATUSES.map((s) => (
            <DropdownMenuCheckboxItem
              key={s}
              checked={selectedStatuses.includes(s)}
              onCheckedChange={(checked) => toggleStatus(s, checked === true)}
              onSelect={(e) => e.preventDefault()}
            >
              {TASK_STATUS_LABELS[s]}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Button
        type="button"
        variant={overdue ? "default" : "outline"}
        onClick={toggleOverdue}
        aria-pressed={overdue}
        className={cn(
          overdue && "bg-destructive hover:bg-destructive/90 text-white",
        )}
      >
        <AlertTriangle className="size-4" />
        Overdue
      </Button>

      <Select
        value={params.get("priority") ?? "all"}
        onValueChange={(v) => setParam("priority", v)}
      >
        <SelectTrigger className="w-36">
          <SelectValue placeholder="Priority" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All priorities</SelectItem>
          <SelectItem value="low">Low</SelectItem>
          <SelectItem value="medium">Medium</SelectItem>
          <SelectItem value="high">High</SelectItem>
          <SelectItem value="critical">Critical</SelectItem>
        </SelectContent>
      </Select>

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={() => router.push(pathname)}>
          <X className="size-4" />
          Clear
        </Button>
      )}
    </div>
  );
}
