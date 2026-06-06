"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Upload, Download, Trash2, FileText } from "lucide-react";

import {
  uploadAttachmentAction,
  deleteAttachmentAction,
  getAttachmentUrlAction,
} from "@/lib/actions/collaboration";
import { can } from "@/lib/permissions";
import { formatDate } from "@/lib/format";
import type { AttachmentWithUploader } from "@/lib/data/types";
import { Button } from "@/components/ui/button";

function fmtSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function AttachmentsSection({
  taskId,
  attachments,
  currentUserId,
  permissions,
}: {
  taskId: string;
  attachments: AttachmentWithUploader[];
  currentUserId: string;
  permissions: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const canUpload = can("attachments.upload", permissions);
  const canDownload = can("attachments.download", permissions);
  const canDeleteAny = can("tasks.delete", permissions);

  const [uploading, setUploading] = useState(false);

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.set("file", file);
    setUploading(true);
    startTransition(async () => {
      const res = await uploadAttachmentAction(taskId, fd);
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
      if (res.ok) {
        toast.success("File uploaded");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  };

  const download = (path: string | null) => {
    if (!path) return;
    startTransition(async () => {
      const res = await getAttachmentUrlAction(path);
      if (res.ok && res.url) window.open(res.url, "_blank", "noopener");
      else toast.error(res.error ?? "Download failed");
    });
  };

  const remove = (id: string) => {
    startTransition(async () => {
      const res = await deleteAttachmentAction(id, taskId);
      if (res.ok) {
        toast.success("Attachment deleted");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  };

  return (
    <div className="space-y-4">
      {attachments.length === 0 && (
        <p className="text-muted-foreground text-sm">No attachments.</p>
      )}

      <ul className="divide-y rounded-md border">
        {attachments.map((a) => (
          <li key={a.id} className="flex items-center gap-3 p-3">
            <FileText className="text-muted-foreground size-4 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{a.file_name}</p>
              <p className="text-muted-foreground text-xs">
                {a.file_type} · {fmtSize(a.file_size_bytes)} ·{" "}
                {a.uploader?.full_name ?? "—"} · {formatDate(a.created_at)}
              </p>
            </div>
            {canDownload && (
              <Button
                variant="ghost"
                size="icon"
                aria-label="Download"
                disabled={pending}
                onClick={() => download(a.storage_path)}
              >
                <Download className="size-4" />
              </Button>
            )}
            {(canDeleteAny || a.uploaded_by === currentUserId) && (
              <Button
                variant="ghost"
                size="icon"
                aria-label="Delete"
                disabled={pending}
                onClick={() => remove(a.id)}
              >
                <Trash2 className="size-4" />
              </Button>
            )}
          </li>
        ))}
      </ul>

      {canUpload && (
        <div>
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            onChange={onFile}
          />
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Upload className="size-4" />
            )}
            Upload file
          </Button>
          <p className="text-muted-foreground mt-1 text-xs">Max 10MB.</p>
        </div>
      )}
    </div>
  );
}
