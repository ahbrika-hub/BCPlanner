"use client";

import { useState, useTransition } from "react";
import {
  Activity,
  MessageSquare,
  Paperclip,
  RefreshCw,
  Loader2,
  type LucideIcon,
} from "lucide-react";

import { loadTaskTimeline } from "@/lib/actions/timeline";
import type {
  TimelineEntry,
  TimelineCursor,
  TimelineType,
} from "@/lib/data/timeline";
import { formatDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

// type → icon mapping lives on the client (the server passes only the string
// `type`, never a component, per the RSC-boundary rule).
const ICONS: Record<TimelineType, LucideIcon> = {
  status: RefreshCw,
  update: Activity,
  comment: MessageSquare,
  attachment: Paperclip,
};

const ICON_TONE: Record<TimelineType, string> = {
  status: "var(--color-info)",
  update: "var(--primary)",
  comment: "var(--secondary)",
  attachment: "var(--color-warning)",
};

function TimelineRow({ entry }: { entry: TimelineEntry }) {
  const Icon = ICONS[entry.type];
  return (
    <li className="flex gap-3">
      <div
        className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full"
        style={{
          color: ICON_TONE[entry.type],
          backgroundColor: `color-mix(in srgb, ${ICON_TONE[entry.type]} 12%, transparent)`,
        }}
        aria-hidden="true"
      >
        <Icon className="size-4" />
      </div>
      <div className="min-w-0 flex-1 border-b pb-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-2">
          <p className="text-sm">
            <span className="font-medium">{entry.actor ?? "Someone"}</span>{" "}
            {entry.summary}
          </p>
          <time className="text-muted-foreground text-xs">
            {formatDateTime(entry.timestamp)}
          </time>
        </div>
        {entry.detail && (
          <p className="text-muted-foreground mt-0.5 text-sm break-words whitespace-pre-wrap">
            {entry.detail}
          </p>
        )}
      </div>
    </li>
  );
}

export function TaskTimeline({
  taskId,
  initialEntries,
  initialCursor,
}: {
  taskId: string;
  initialEntries: TimelineEntry[];
  initialCursor: TimelineCursor | null;
}) {
  const [entries, setEntries] = useState(initialEntries);
  const [cursor, setCursor] = useState(initialCursor);
  const [pending, startTransition] = useTransition();

  const loadMore = () => {
    startTransition(async () => {
      const page = await loadTaskTimeline(taskId, cursor);
      setEntries((prev) => [...prev, ...page.entries]);
      setCursor(page.nextCursor);
    });
  };

  if (entries.length === 0) {
    return (
      <EmptyState
        title="No activity yet"
        description="Updates, comments, attachments, and status changes will appear here."
      />
    );
  }

  return (
    <div className="space-y-4">
      <ol className="space-y-3">
        {entries.map((e) => (
          <TimelineRow key={`${e.type}:${e.id}`} entry={e} />
        ))}
      </ol>
      {cursor && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={loadMore}
            disabled={pending}
          >
            {pending && <Loader2 className="size-4 animate-spin" />}
            Load more
          </Button>
        </div>
      )}
    </div>
  );
}
