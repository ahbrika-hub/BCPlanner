"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Bookmark, ChevronDown, Loader2, Pencil, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import {
  searchParamsToConfig,
  type SavedViewConfig,
} from "@/lib/tasks/saved-view-config";
import {
  createSavedViewAction,
  renameSavedViewAction,
  updateSavedViewConfigAction,
  deleteSavedViewAction,
} from "@/lib/actions/saved-views";
import { useSession } from "@/components/providers/session-provider";
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
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const nameSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required.")
    .max(80, "Name must be 80 characters or fewer."),
});
type NameValues = z.infer<typeof nameSchema>;

function NameDialog({
  open,
  onOpenChange,
  title,
  description,
  submitLabel,
  defaultName,
  pending,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  submitLabel: string;
  defaultName?: string;
  pending: boolean;
  onSubmit: (name: string) => void;
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<NameValues>({
    resolver: zodResolver(nameSchema),
    values: { name: defaultName ?? "" },
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={handleSubmit((values) => onSubmit(values.name))}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="saved-view-name">Name</Label>
            <Input
              id="saved-view-name"
              autoFocus
              placeholder="e.g. My overdue tasks"
              {...register("name")}
            />
            {errors.name && (
              <p className="text-destructive text-xs">{errors.name.message}</p>
            )}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Save / apply controls for the Tasks list. Reads the CURRENT filter+sort from
 * the existing URL params (the same ones TaskFilters / TasksTable read), and
 * persists them as a personal Saved View. When a view is applied (the `view`
 * query param matches one of the caller's views) it also offers Update (re-save
 * the current filters), Rename, and Delete. Applying a view is just navigation
 * to /tasks with the view's stored query string (handled by the sidebar links),
 * so there is no parallel filtering path here.
 */
export function SavedViewControls() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { savedViews } = useSession();
  const [pending, startTransition] = useTransition();
  const [createOpen, setCreateOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);

  const currentConfig: SavedViewConfig = useMemo(
    () => searchParamsToConfig(new URLSearchParams(searchParams.toString())),
    [searchParams],
  );

  const activeViewId = searchParams.get("view");
  const activeView =
    savedViews.find((v) => v.id === activeViewId) ?? null;

  const create = (name: string) =>
    startTransition(async () => {
      const res = await createSavedViewAction({ name, config: currentConfig });
      if (res.ok) {
        toast.success("View saved");
        setCreateOpen(false);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });

  const rename = (name: string) => {
    if (!activeView) return;
    startTransition(async () => {
      const res = await renameSavedViewAction({ id: activeView.id, name });
      if (res.ok) {
        toast.success("View renamed");
        setRenameOpen(false);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  };

  const update = () => {
    if (!activeView) return;
    startTransition(async () => {
      const res = await updateSavedViewConfigAction({
        id: activeView.id,
        config: currentConfig,
      });
      if (res.ok) {
        toast.success("View updated to current filters");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  };

  const remove = () => {
    if (!activeView) return;
    startTransition(async () => {
      const res = await deleteSavedViewAction(activeView.id);
      if (res.ok) {
        toast.success("View deleted");
        router.push("/tasks");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  };

  return (
    <>
      {activeView ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" disabled={pending}>
              <Bookmark className="size-4" />
              <span className="max-w-40 truncate">{activeView.name}</span>
              <ChevronDown className="size-4 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => update()}>
              <Save className="size-4" />
              Update to current filters
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setRenameOpen(true)}>
              <Pencil className="size-4" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setCreateOpen(true)}>
              <Bookmark className="size-4" />
              Save as new view
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => remove()}>
              <Trash2 className="size-4" />
              Delete view
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <Button
          variant="outline"
          onClick={() => setCreateOpen(true)}
          disabled={pending}
        >
          <Bookmark className="size-4" />
          Save view
        </Button>
      )}

      <NameDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Save view"
        description="Save the current filters and sort as a personal view you can re-apply from the sidebar."
        submitLabel="Save"
        pending={pending}
        onSubmit={create}
      />

      <NameDialog
        open={renameOpen}
        onOpenChange={setRenameOpen}
        title="Rename view"
        description="Give this saved view a new name."
        submitLabel="Rename"
        defaultName={activeView?.name}
        pending={pending}
        onSubmit={rename}
      />
    </>
  );
}
