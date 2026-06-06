"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { updateSettingsAction } from "@/lib/actions/settings";
import type { Tables } from "@/lib/data/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Setting = Tables["app_settings"]["Row"];

const META: Record<string, { label: string; hint: string; numeric: boolean }> =
  {
    due_soon_threshold: {
      label: "Due-soon threshold (days)",
      hint: "Flag a task as due soon this many days before its due date.",
      numeric: true,
    },
    no_update_threshold: {
      label: "No-update threshold (days)",
      hint: "Flag a task as stale after this many days without an update.",
      numeric: true,
    },
  };

export function SettingsForm({
  settings,
  canManage,
}: {
  settings: Setting[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(settings.map((s) => [s.key, s.value])),
  );

  const save = () => {
    startTransition(async () => {
      const res = await updateSettingsAction({
        settings: settings.map((s) => ({
          key: s.key,
          value: values[s.key] ?? s.value,
        })),
      });
      if (res.ok) {
        toast.success("Settings saved");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  };

  return (
    <div className="max-w-xl space-y-6">
      {settings.map((s) => {
        const meta = META[s.key];
        return (
          <div key={s.key} className="space-y-1.5">
            <Label htmlFor={s.key}>{meta?.label ?? s.key}</Label>
            <Input
              id={s.key}
              type={meta?.numeric ? "number" : "text"}
              value={values[s.key] ?? ""}
              disabled={!canManage}
              onChange={(e) =>
                setValues((v) => ({ ...v, [s.key]: e.target.value }))
              }
            />
            <p className="text-muted-foreground text-xs">
              {meta?.hint ?? s.description ?? ""}
            </p>
          </div>
        );
      })}

      {canManage && (
        <Button onClick={save} disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          Save settings
        </Button>
      )}
    </div>
  );
}
