"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { z } from "zod";

import { createProjectSchema } from "@/lib/validations";
import {
  createProjectAction,
  setProjectActiveAction,
} from "@/lib/actions/projects";
import type { ProjectWithBusinessLine } from "@/lib/data/projects";
import type { BusinessLineRow } from "@/lib/data/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

type FormValues = z.input<typeof createProjectSchema>;

function NewProjectDialog({
  businessLines,
}: {
  businessLines: BusinessLineRow[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(createProjectSchema) });

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      const cleaned = Object.fromEntries(
        Object.entries(values).filter(([, v]) => v !== "" && v !== undefined),
      );
      const res = await createProjectAction(cleaned);
      if (res.ok) {
        toast.success("Project created");
        reset();
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
          New Project
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Project</DialogTitle>
          <DialogDescription>
            Projects are a reference list used to categorise tasks.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" {...register("name")} />
            {errors.name && (
              <p className="text-destructive text-xs">{errors.name.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Business line (optional)</Label>
            <Select onValueChange={(v) => setValue("business_line_id", v)}>
              <SelectTrigger>
                <SelectValue placeholder="None" />
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
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ProjectsManager({
  rows,
  businessLines,
}: {
  rows: ProjectWithBusinessLine[];
  businessLines: BusinessLineRow[];
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const toggleActive = (id: string, isActive: boolean) =>
    startTransition(async () => {
      const res = await setProjectActiveAction(id, isActive);
      if (res.ok) {
        toast.success(isActive ? "Project activated" : "Project deactivated");
        router.refresh();
      } else {
        toast.error(res.error ?? "Failed");
      }
    });

  return (
    <>
      <div className="mb-4 flex justify-end">
        <NewProjectDialog businessLines={businessLines} />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="No projects"
          description="Create a project to start categorising tasks."
        />
      ) : (
        <div className="rounded-lg border">
          <Table stickyFirstColumn>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Business line</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {p.business_line?.name ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={p.is_active ? "default" : "secondary"}>
                      {p.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={pending}
                      onClick={() => toggleActive(p.id, !p.is_active)}
                    >
                      {p.is_active ? "Deactivate" : "Activate"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
