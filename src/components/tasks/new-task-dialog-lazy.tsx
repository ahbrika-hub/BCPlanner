"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { NewTaskDialog as NewTaskDialogComponent } from "./new-task-dialog";

// Lazy boundary so the create-task dialog (form + react-hook-form + Zod) is
// code-split off the initial bundle and loaded client-side after hydration.
// ssr:false requires a client component, hence this thin wrapper (the trigger
// sites are Server Components). The fallback mirrors the real trigger button so
// there's no layout shift. Form/validation/submit behaviour is unchanged.
const NewTaskDialog = dynamic(
  () => import("./new-task-dialog").then((m) => m.NewTaskDialog),
  {
    ssr: false,
    loading: () => (
      <Button disabled>
        <Plus className="size-4" />
        New Task
      </Button>
    ),
  },
);

export function NewTaskDialogLazy(
  props: ComponentProps<typeof NewTaskDialogComponent>,
) {
  return <NewTaskDialog {...props} />;
}
