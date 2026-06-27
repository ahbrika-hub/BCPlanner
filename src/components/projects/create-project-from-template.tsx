"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { createProjectFromTemplateAction } from "@/lib/actions/project-templates";
import type { ProjectTemplateWithTasks } from "@/lib/data/project-templates";
import type { BusinessLineRow } from "@/lib/data/types";
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

/**
 * "Create project from template" — creates the project via the existing
 * createProjectAction, then generates the template's tasks via the existing
 * createTaskAction (createProjectFromTemplateAction orchestrates both). No raw
 * bulk insert; each task gets a real task number, status, and audit trail.
 */
export function CreateProjectFromTemplate({
  templates,
  businessLines,
}: {
  templates: ProjectTemplateWithTasks[];
  businessLines: BusinessLineRow[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [templateId, setTemplateId] = useState("");
  const [name, setName] = useState("");
  const [businessLineId, setBusinessLineId] = useState<string | undefined>();

  const selected = templates.find((t) => t.id === templateId);

  const submit = () => {
    if (!templateId || name.trim().length < 2) return;
    startTransition(async () => {
      const res = await createProjectFromTemplateAction({
        template_id: templateId,
        name: name.trim(),
        business_line_id: businessLineId,
      });
      if (res.ok) {
        toast.success(
          `Project created with ${res.createdCount} task${res.createdCount === 1 ? "" : "s"}`,
        );
        setOpen(false);
        setTemplateId("");
        setName("");
        setBusinessLineId(undefined);
        router.refresh();
      } else {
        // Partial build is surfaced, not hidden.
        toast.error(res.error);
        if (res.projectId) router.refresh();
      }
    });
  };

  if (templates.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Sparkles className="size-4" />
          New from template
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create project from template</DialogTitle>
          <DialogDescription>
            Creates the project and generates its standard tasks through the
            normal task-creation path.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Template</Label>
            <Select value={templateId} onValueChange={setTemplateId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a template" />
              </SelectTrigger>
              <SelectContent>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name} ({t.tasks.length} tasks)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selected && (
              <p className="text-muted-foreground text-xs">
                Will generate {selected.tasks.length} task
                {selected.tasks.length === 1 ? "" : "s"}.
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="project-name">Project name</Label>
            <Input
              id="project-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Business line (optional)</Label>
            <Select
              value={businessLineId}
              onValueChange={(v) => setBusinessLineId(v)}
            >
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
        </div>
        <DialogFooter>
          <Button
            onClick={submit}
            disabled={pending || !templateId || name.trim().length < 2}
          >
            {pending && <Loader2 className="size-4 animate-spin" />}
            Create project
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
