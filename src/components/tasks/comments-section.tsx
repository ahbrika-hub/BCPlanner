"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, CheckCircle2 } from "lucide-react";

import {
  addCommentAction,
  markAddressedAction,
} from "@/lib/actions/collaboration";
import { can } from "@/lib/permissions";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { MentionableUser } from "@/lib/data/comments";
import type {
  CommentWithAuthor,
  CommentType,
  UserRole,
} from "@/lib/data/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

const commentTypeLabels: Record<string, string> = {
  general: "General",
  task_specific: "Task",
  ceo_office_comment: "CEO Office",
};

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Render a comment body, styling any `@Name` that matches one of the comment's
 * mentioned users as a chip. Names are matched longest-first so "@Ann Marie"
 * wins over "@Ann". Purely presentational — the authoritative mention list is
 * the persisted `mentioned_user_ids`.
 */
function renderBody(text: string, names: string[]): React.ReactNode {
  const present = names.filter((n) => n && text.includes(`@${n}`));
  if (present.length === 0) return text;
  const sorted = [...present].sort((a, b) => b.length - a.length);
  const pattern = new RegExp(
    `@(?:${sorted.map(escapeRegExp).join("|")})`,
    "g",
  );
  const out: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = pattern.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push(
      <span
        key={`m-${i++}`}
        className="bg-primary/10 text-primary rounded px-1 font-medium"
      >
        {m[0]}
      </span>,
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function CommentsSection({
  taskId,
  comments,
  role,
  permissions,
  mentionableUsers = [],
  mentionNameById = {},
}: {
  taskId: string;
  comments: CommentWithAuthor[];
  role: UserRole;
  permissions: string[];
  mentionableUsers?: MentionableUser[];
  mentionNameById?: Record<string, string>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [text, setText] = useState("");
  const taRef = useRef<HTMLTextAreaElement>(null);

  // Picker state: the active "@query", the candidate list, and the highlighted
  // index. selected maps a chosen user's id → the name inserted, so submit can
  // pass ids while dropping any whose "@name" the user later deleted.
  const [query, setQuery] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const [selected, setSelected] = useState<Map<string, string>>(new Map());

  const canComment = can("task_comments.create", permissions);
  const canAddress = can("task_comments.address", permissions);
  const isCeo = role === "ceo";

  const candidates = useMemo(() => {
    if (query === null) return [];
    const q = query.toLowerCase();
    return mentionableUsers
      .filter((u) => u.display_name.toLowerCase().includes(q))
      .slice(0, 6);
  }, [query, mentionableUsers]);

  // Recompute the active "@token" immediately before the caret.
  const syncQuery = (value: string, caret: number) => {
    const before = value.slice(0, caret);
    const match = /@([^\s@]*)$/.exec(before);
    if (match) {
      setQuery(match[1] ?? "");
      setActive(0);
    } else {
      setQuery(null);
    }
  };

  const onChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    syncQuery(e.target.value, e.target.selectionStart ?? e.target.value.length);
  };

  const pick = (user: MentionableUser) => {
    const el = taRef.current;
    const caret = el?.selectionStart ?? text.length;
    const before = text.slice(0, caret);
    const after = text.slice(caret);
    const replaced = before.replace(/@([^\s@]*)$/, `@${user.display_name} `);
    const next = replaced + after;
    setText(next);
    setSelected((prev) => new Map(prev).set(user.id, user.display_name));
    setQuery(null);
    // Restore focus + caret after the inserted mention.
    requestAnimationFrame(() => {
      el?.focus();
      const pos = replaced.length;
      el?.setSelectionRange(pos, pos);
    });
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (query !== null && candidates.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((a) => (a + 1) % candidates.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((a) => (a - 1 + candidates.length) % candidates.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        const choice = candidates[active];
        if (choice) pick(choice);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setQuery(null);
        return;
      }
    }
  };

  const submit = () => {
    if (!text.trim()) return;
    const type: CommentType = isCeo ? "ceo_office_comment" : "general";
    // Keep only mentions whose "@name" survives in the final text.
    const mentionedUserIds = [...selected.entries()]
      .filter(([, name]) => text.includes(`@${name}`))
      .map(([id]) => id);
    startTransition(async () => {
      const res = await addCommentAction(taskId, text, type, mentionedUserIds);
      if (res.ok) {
        toast.success("Comment added");
        setText("");
        setSelected(new Map());
        setQuery(null);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  };

  const address = (commentId: string) => {
    startTransition(async () => {
      const res = await markAddressedAction(commentId, taskId);
      if (res.ok) {
        toast.success("Marked as addressed");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  };

  return (
    <div className="space-y-4">
      {comments.length === 0 && (
        <p className="text-muted-foreground text-sm">No comments yet.</p>
      )}

      <ul className="space-y-3">
        {comments.map((c) => {
          const names = (c.mentioned_user_ids ?? [])
            .map((id) => mentionNameById[id])
            .filter(Boolean) as string[];
          return (
            <li key={c.id} className="rounded-md border p-3">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">
                  {c.author?.full_name ?? "Unknown"}
                </span>
                <Badge variant="outline" className="text-[10px]">
                  {c.comment_role}
                </Badge>
                {c.comment_type === "ceo_office_comment" && (
                  <Badge className="bg-secondary text-secondary-foreground text-[10px]">
                    {commentTypeLabels[c.comment_type]}
                  </Badge>
                )}
                <span className="text-muted-foreground ml-auto text-xs">
                  {formatDateTime(c.created_at)}
                </span>
              </div>
              <p className="text-sm whitespace-pre-wrap">
                {renderBody(c.comment_text, names)}
              </p>

              {c.comment_type === "ceo_office_comment" && (
                <div className="mt-2 flex items-center gap-2">
                  {c.is_addressed ? (
                    <span className="text-success inline-flex items-center gap-1 text-xs">
                      <CheckCircle2 className="size-3.5" />
                      Addressed by {c.addresser?.full_name ?? "—"}
                    </span>
                  ) : (
                    canAddress && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={pending}
                        onClick={() => address(c.id)}
                      >
                        Mark as addressed
                      </Button>
                    )
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {canComment && (
        <div className="space-y-2 border-t pt-4">
          <Label htmlFor="comment">
            {isCeo ? "Add CEO Office comment" : "Add comment"}
          </Label>
          <div className="relative">
            <Textarea
              id="comment"
              ref={taRef}
              rows={3}
              value={text}
              onChange={onChange}
              onKeyDown={onKeyDown}
              placeholder="Write a comment. Type @ to mention someone on this task."
            />
            {query !== null && candidates.length > 0 && (
              <ul
                role="listbox"
                className="bg-popover absolute z-10 mt-1 w-64 overflow-hidden rounded-md border shadow-md"
              >
                {candidates.map((u, i) => (
                  <li key={u.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={i === active}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        pick(u);
                      }}
                      onMouseEnter={() => setActive(i)}
                      className={cn(
                        "block w-full px-3 py-1.5 text-left text-sm",
                        i === active
                          ? "bg-accent text-accent-foreground"
                          : "hover:bg-accent/50",
                      )}
                    >
                      {u.display_name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <Button size="sm" onClick={submit} disabled={pending || !text.trim()}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            Post
          </Button>
        </div>
      )}
    </div>
  );
}
