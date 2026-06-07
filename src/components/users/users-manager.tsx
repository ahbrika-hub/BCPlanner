"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, UserPlus, Search } from "lucide-react";
import { toast } from "sonner";

import { updateUserAction, inviteUserAction } from "@/lib/actions/users";
import type { UserWithDepartment } from "@/lib/data/users";
import type { Tables } from "@/lib/data/types";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";

type Department = Tables["departments"]["Row"];
const ROLES = ["admin", "section_head", "employee", "ceo"] as const;
const roleLabels: Record<string, string> = {
  admin: "Admin",
  section_head: "Section Head",
  employee: "Employee",
  ceo: "CEO",
};

function initials(name: string, email: string) {
  const s = (name.trim() || email).split(/[\s@.]+/).filter(Boolean);
  return (s[0]?.[0] ?? "?").concat(s[1]?.[0] ?? "").toUpperCase();
}

function EditUserDialog({
  user,
  departments,
  currentUserId,
}: {
  user: UserWithDepartment;
  departments: Department[];
  currentUserId: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const [fullName, setFullName] = useState(user.full_name);
  const [jobTitle, setJobTitle] = useState(user.job_title ?? "");
  const [role, setRole] = useState(user.role);
  const [departmentId, setDepartmentId] = useState(
    user.department_id ?? "none",
  );
  const [active, setActive] = useState(user.is_active);

  const save = () => {
    const editingSelf = user.id === currentUserId;
    if (editingSelf && (role !== user.role || active !== user.is_active)) {
      if (
        !window.confirm(
          "You're changing your own role or active status. Continue?",
        )
      )
        return;
    }
    startTransition(async () => {
      const res = await updateUserAction(user.id, {
        full_name: fullName,
        job_title: jobTitle || undefined,
        role,
        department_id: departmentId === "none" ? null : departmentId,
        is_active: active,
      });
      if (res.ok) {
        toast.success("User updated");
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
        <Button variant="ghost" size="icon" aria-label="Edit user">
          <Pencil className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit {user.full_name || user.email}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fn">Full name</Label>
            <Input
              id="fn"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="jt">Job title</Label>
            <Input
              id="jt"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                value={role}
                onValueChange={(v) => setRole(v as typeof role)}
              >
                <SelectTrigger>
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
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={active ? "active" : "inactive"}
                onValueChange={(v) => setActive(v === "active")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Department</Label>
            <Select value={departmentId} onValueChange={setDepartmentId}>
              <SelectTrigger>
                <SelectValue />
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
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={pending}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function InviteDialog() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [pending, startTransition] = useTransition();

  const invite = () => {
    startTransition(async () => {
      const res = await inviteUserAction(email);
      if (res.ok) toast.success("Invitation sent");
      else toast.message("Invite via Dashboard", { description: res.error });
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <UserPlus className="size-4" />
          Invite User
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite User</DialogTitle>
          <DialogDescription>
            Invites are currently issued from the Supabase Dashboard
            (Authentication → Invite User). The new user appears here as an
            employee; set their role and department from this screen. Direct
            invites are enabled in Phase 7 once the service-role key is rotated.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="person@tss.example"
          />
        </div>
        <DialogFooter>
          <Button onClick={invite} disabled={pending || !email}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            Try invite
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function UsersManager({
  users,
  departments,
  canManage,
  canInvite,
  currentUserId,
}: {
  users: UserWithDepartment[];
  departments: Department[];
  canManage: boolean;
  canInvite: boolean;
  currentUserId: string;
}) {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [activeFilter, setActiveFilter] = useState("all");

  const filtered = useMemo(
    () =>
      users.filter((u) => {
        if (roleFilter !== "all" && u.role !== roleFilter) return false;
        if (activeFilter !== "all" && String(u.is_active) !== activeFilter)
          return false;
        if (search) {
          const q = search.toLowerCase();
          if (
            !u.full_name.toLowerCase().includes(q) &&
            !u.email.toLowerCase().includes(q)
          )
            return false;
        }
        return true;
      }),
    [users, search, roleFilter, activeFilter],
  );

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="text-muted-foreground absolute top-2.5 left-2.5 size-4" />
          <Input
            placeholder="Search name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-56 pl-8"
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            {ROLES.map((r) => (
              <SelectItem key={r} value={r}>
                {roleLabels[r]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={activeFilter} onValueChange={setActiveFilter}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="true">Active</SelectItem>
            <SelectItem value="false">Inactive</SelectItem>
          </SelectContent>
        </Select>
        {canInvite && (
          <div className="ml-auto">
            <InviteDialog />
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No users found"
          description="Adjust the filters above."
        />
      ) : (
        <div className="rounded-lg border">
          <Table stickyFirstColumn>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Status</TableHead>
                {canManage && (
                  <TableHead className="text-right">Edit</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="size-7">
                        <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                          {initials(u.full_name, u.email)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {u.full_name || "—"}
                        </p>
                        <p className="text-muted-foreground truncate text-xs">
                          {u.email}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{roleLabels[u.role]}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {u.department?.name ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={u.is_active ? "default" : "secondary"}>
                      {u.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  {canManage && (
                    <TableCell className="text-right">
                      <EditUserDialog
                        user={u}
                        departments={departments}
                        currentUserId={currentUserId}
                      />
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
