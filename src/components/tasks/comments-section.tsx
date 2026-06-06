"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, CheckCircle2 } from "lucide-react";

import {
  addCommentAction,
  markAddressedAction,
} from "@/lib/actions/collaboration";
import { can } from "@/lib/permissions";
import { formatDateTime } from "@/lib/format";
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

export function CommentsSection({
  taskId,
  comments,
  role,
  permissions,
}: {
  taskId: string;
  comments: CommentWithAuthor[];
  role: UserRole;
  permissions: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [text, setText] = useState("");

  const canComment = can("task_comments.create", permissions);
  const canAddress = can("task_comments.address", permissions);
  const isCeo = role === "ceo";

  const submit = () => {
    if (!text.trim()) return;
    const type: CommentType = isCeo ? "ceo_office_comment" : "general";
    startTransition(async () => {
      const res = await addCommentAction(taskId, text, type);
      if (res.ok) {
        toast.success("Comment added");
        setText("");
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
        {comments.map((c) => (
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
            <p className="text-sm whitespace-pre-wrap">{c.comment_text}</p>

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
        ))}
      </ul>

      {canComment && (
        <div className="space-y-2 border-t pt-4">
          <Label htmlFor="comment">
            {isCeo ? "Add CEO Office comment" : "Add comment"}
          </Label>
          <Textarea
            id="comment"
            rows={3}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <Button size="sm" onClick={submit} disabled={pending || !text.trim()}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            Post
          </Button>
        </div>
      )}
    </div>
  );
}
