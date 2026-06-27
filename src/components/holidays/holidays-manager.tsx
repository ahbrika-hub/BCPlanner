"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Loader2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { z } from "zod";

import { createHolidaySchema } from "@/lib/validations";
import {
  createHolidayAction,
  updateHolidayAction,
  deleteHolidayAction,
} from "@/lib/actions/holidays";
import type { HolidayRow } from "@/lib/data/holidays";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";

type FormValues = z.input<typeof createHolidaySchema>;

function HolidayDialog({
  trigger,
  title,
  defaults,
  onSubmit,
  pending,
}: {
  trigger: React.ReactNode;
  title: string;
  defaults?: FormValues;
  onSubmit: (values: FormValues) => Promise<boolean>;
  pending: boolean;
}) {
  const [open, setOpen] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(createHolidaySchema),
    values: defaults,
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset(defaults);
        setOpen(o);
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Public holidays are subtracted from each employee&apos;s working-day
            capacity.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={handleSubmit(async (values) => {
            const ok = await onSubmit(values);
            if (ok) {
              reset(defaults);
              setOpen(false);
            }
          })}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="holiday_date">Date</Label>
            <Input id="holiday_date" type="date" {...register("holiday_date")} />
            {errors.holiday_date && (
              <p className="text-destructive text-xs">
                {errors.holiday_date.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" placeholder="e.g. Eid al-Fitr" {...register("name")} />
            {errors.name && (
              <p className="text-destructive text-xs">{errors.name.message}</p>
            )}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function HolidaysManager({ rows }: { rows: HolidayRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const create = (values: FormValues) =>
    new Promise<boolean>((resolve) => {
      startTransition(async () => {
        const res = await createHolidayAction(values);
        if (res.ok) {
          toast.success("Holiday added");
          router.refresh();
          resolve(true);
        } else {
          toast.error(res.error);
          resolve(false);
        }
      });
    });

  const edit = (id: string, values: FormValues) =>
    new Promise<boolean>((resolve) => {
      startTransition(async () => {
        const res = await updateHolidayAction({ id, ...values });
        if (res.ok) {
          toast.success("Holiday updated");
          router.refresh();
          resolve(true);
        } else {
          toast.error(res.error);
          resolve(false);
        }
      });
    });

  const remove = (id: string) =>
    startTransition(async () => {
      const res = await deleteHolidayAction(id);
      if (res.ok) {
        toast.success("Holiday deleted");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });

  return (
    <>
      <div className="mb-4 flex justify-end">
        <HolidayDialog
          title="Add holiday"
          pending={pending}
          onSubmit={create}
          trigger={
            <Button>
              <Plus className="size-4" />
              Add holiday
            </Button>
          }
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="No holidays"
          description="Add public holidays to reduce working-day capacity."
        />
      ) : (
        <div className="rounded-lg border">
          <Table stickyFirstColumn>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((h) => (
                <TableRow key={h.id}>
                  <TableCell className="font-mono text-sm">
                    {h.holiday_date}
                  </TableCell>
                  <TableCell className="font-medium">{h.name}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <HolidayDialog
                        title="Edit holiday"
                        pending={pending}
                        defaults={{
                          holiday_date: h.holiday_date,
                          name: h.name,
                        }}
                        onSubmit={(values) => edit(h.id, values)}
                        trigger={
                          <Button variant="ghost" size="sm">
                            <Pencil className="size-4" />
                            <span className="sr-only">Edit</span>
                          </Button>
                        }
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={pending}
                        onClick={() => remove(h.id)}
                      >
                        <Trash2 className="size-4" />
                        <span className="sr-only">Delete</span>
                      </Button>
                    </div>
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
