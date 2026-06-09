"use client";

import { useRouter } from "next/navigation";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

/**
 * Client shell for the intercepted task-detail route. Wraps the reused
 * server-rendered {@link TaskDetailContent} in a Dialog. Closing — via the X,
 * Esc, or a click outside — calls router.back() to dismiss the intercepted
 * slot and return to the underlying page. Hard-navigating to /tasks/[id]
 * bypasses interception and renders the full page instead (URL fallback).
 */
export function TaskDetailModal({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) router.back();
      }}
    >
      <DialogContent
        aria-describedby={undefined}
        className="max-h-[90vh] max-w-3xl overflow-y-auto"
      >
        {/* The reused content renders its own visible heading; this keeps the
            dialog accessible without duplicating the title visually. */}
        <DialogTitle className="sr-only">Task details</DialogTitle>
        {children}
      </DialogContent>
    </Dialog>
  );
}
