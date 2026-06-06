import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Tables, AttachmentWithUploader } from "./types";

export const ATTACHMENT_BUCKET = "task-attachments";
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024; // 10MB

const TYPE_BY_EXT: Record<string, string> = {
  ppt: "PPT",
  pptx: "PPT",
  xls: "Excel",
  xlsx: "Excel",
  csv: "Excel",
  doc: "Word",
  docx: "Word",
  pdf: "PDF",
  png: "Image",
  jpg: "Image",
  jpeg: "Image",
  gif: "Image",
  webp: "Image",
};

export function classifyFileType(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  return TYPE_BY_EXT[ext] ?? "Other";
}

export async function listAttachments(
  taskId: string,
): Promise<AttachmentWithUploader[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("task_attachments")
    .select(
      "*, uploader:profiles!task_attachments_uploaded_by_fkey(id, full_name)",
    )
    .eq("task_id", taskId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as AttachmentWithUploader[];
}

export async function uploadAttachment(
  taskId: string,
  uploadedBy: string,
  file: File,
): Promise<Tables["task_attachments"]["Row"]> {
  if (file.size > MAX_ATTACHMENT_BYTES) {
    throw new Error("File exceeds the 10MB limit.");
  }
  const supabase = await createClient();
  const path = `${taskId}/${crypto.randomUUID()}-${file.name}`;

  const { error: uploadError } = await supabase.storage
    .from(ATTACHMENT_BUCKET)
    .upload(path, file, { contentType: file.type || undefined });
  if (uploadError) throw new Error(uploadError.message);

  const { data, error } = await supabase
    .from("task_attachments")
    .insert({
      task_id: taskId,
      uploaded_by: uploadedBy,
      file_name: file.name,
      file_type: classifyFileType(file.name),
      storage_path: path,
      file_size_bytes: file.size,
    })
    .select("*")
    .single();
  if (error) {
    // best-effort cleanup of the orphaned object
    await supabase.storage.from(ATTACHMENT_BUCKET).remove([path]);
    throw new Error(error.message);
  }
  return data;
}

export async function getAttachmentSignedUrl(
  path: string,
  expiresIn = 60,
): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.storage
    .from(ATTACHMENT_BUCKET)
    .createSignedUrl(path, expiresIn);
  return data?.signedUrl ?? null;
}

export async function deleteAttachment(id: string): Promise<void> {
  const supabase = await createClient();
  const { data: row } = await supabase
    .from("task_attachments")
    .select("storage_path")
    .eq("id", id)
    .maybeSingle();

  if (row?.storage_path) {
    await supabase.storage.from(ATTACHMENT_BUCKET).remove([row.storage_path]);
  }
  const { error } = await supabase
    .from("task_attachments")
    .delete()
    .eq("id", id);
  if (error) throw new Error(error.message);
}
