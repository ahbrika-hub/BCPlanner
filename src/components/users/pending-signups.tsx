"use client";

import { useState, useTransition } from "react";
import { Check, Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { approveSignupAction } from "@/lib/actions/users";
import { formatDateTime } from "@/lib/format";
import type { UserWithDepartment } from "@/lib/data/users";
import type { Tables } from "@/lib/data/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Department = Tables["departments"]["Row"];

const ROLES = ["employee", "section_head", "admin", "ceo"] as const;
const roleLabels: Record<string, string> = {
  admin: "Admin",
  section_head: "Section Head",
  employee: "Employee",
  ceo: "CEO",
};

function PendingRow({
  user,
  departments,
}: {
  user: UserWithDepartment;
  departments: Department[];
}) {
  const [role, setRole] = useState<(typeof ROLES)[number]>("employee");
  const [departmentId, setDepartmentId] = useState("none");
  const [pending, startTransition] = useTransition();

  function approve() {
    startTransition(async () => {
      const res = await approveSignupAction(user.id, {
        role,
        department_id: departmentId === "none" ? null : departmentId,
      });
      if (res.ok) {
        toast.success(`Approved ${user.email}`);
      } else {
        toast.error(res.error ?? "Could not approve.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-3 py-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">
          {user.full_name || user.email}
        </p>
        <p className="text-fg-muted text-xs">
          {user.email} · registered {formatDateTime(user.created_at)}
        </p>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Role</Label>
          <Select
            value={role}
            onValueChange={(v) => setRole(v as (typeof ROLES)[number])}
          >
            <SelectTrigger className="w-36" size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLES.map((r) => (
                <SelectItem key={r} value={r}>
                  {roleLabels[r]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Business line</Label>
          <Select value={departmentId} onValueChange={setDepartmentId}>
            <SelectTrigger className="w-44" size="sm">
              <SelectValue placeholder="None" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {departments.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" onClick={approve} disabled={pending}>
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Check className="size-4" />
          )}
          Approve
        </Button>
      </div>
    </div>
  );
}

export function PendingSignups({
  users,
  departments,
}: {
  users: UserWithDepartment[];
  departments: Department[];
}) {
  if (users.length === 0) return null;

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <UserPlus className="text-primary size-4" aria-hidden="true" />
          Pending registrations
          <span className="bg-primary/10 text-primary ml-1 rounded-full px-2 py-0.5 text-xs font-medium">
            {users.length}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="divide-border divide-y pt-0">
        {users.map((u) => (
          <PendingRow key={u.id} user={u} departments={departments} />
        ))}
      </CardContent>
    </Card>
  );
}
