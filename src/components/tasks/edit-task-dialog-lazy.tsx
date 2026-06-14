"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import { Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { EditTaskDialog as EditTaskDialogComponent } from "./edit-task-dialog";

// Lazy boundary so the edit-task dialog (form + react-hook-form + Zod) is
// code-split off the initial bundle and loaded client-side after hydration.
// ssr:false requires a client component, hence this thin wrapper (the trigger
// site, task-detail-content, is a Server Component). The fallback mirrors the
// real trigger button so there's no layout shift. Behaviour is unchanged.
const EditTaskDialog = dynamic(
  () => import("./edit-task-dialog").then((m) => m.EditTaskDialog),
  {
    ssr: false,
    loading: () => (
      <Button variant="outline" size="sm" disabled>
        <Pencil className="size-4" />
        Edit
      </Button>
    ),
  },
);

export function EditTaskDialogLazy(
  props: ComponentProps<typeof EditTaskDialogComponent>,
) {
  return <EditTaskDialog {...props} />;
}
