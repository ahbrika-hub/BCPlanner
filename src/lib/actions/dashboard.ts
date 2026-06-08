"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/session";
import { parseWeeklyWorkbook } from "@/lib/dashboard/parse-workbook";
import { uploadAttachment } from "@/lib/data/attachments";
import { dashboardDataSchema } from "@/lib/validations/dashboard";

const MAX_BYTES = 5 * 1024 * 1024; // ~5MB
const BUCKET = "dashboard-uploads";

export type UploadDashboardResult =
  | { ok: true; weekStart: string }
  | { ok: false; error: string };

/**
 * Parse + validate a clean weekly Excel workbook and store a snapshot. Accepts
 * .xlsx only (≤5MB). On any parse/validation failure nothing is stored.
 */
export async function uploadWeeklyDashboard(
  formData: FormData,
): Promise<UploadDashboardResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated." };

  const file = formData.get("file");
  const taskIdRaw = formData.get("taskId");
  const taskId = typeof taskIdRaw === "string" && taskIdRaw ? taskIdRaw : null;

  if (!(file instanceof File)) return { ok: false, error: "No file provided." };
  if (!file.name.toLowerCase().endsWith(".xlsx")) {
    return { ok: false, error: "Only .xlsx files are accepted." };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, error: "File exceeds the 5MB limit." };
  }

  // Read once; reuse the buffer for parsing and for the raw upload.
  const buffer = Buffer.from(await file.arrayBuffer());

  let data;
  try {
    const parsed = await parseWeeklyWorkbook(buffer);
    const result = dashboardDataSchema.safeParse(parsed);
    if (!result.success) {
      const issue = result.error.issues[0];
      const where = issue?.path.join(".") || "data";
      return {
        ok: false,
        error: `Workbook is not valid (${where}): ${issue?.message ?? "schema error"}.`,
      };
    }
    data = result.data;
  } catch (e) {
    return {
      ok: false,
      error:
        e instanceof Error
          ? `Could not read the workbook: ${e.message}`
          : "Could not read the workbook.",
    };
  }

  if (!data.meta.weekStart) {
    return { ok: false, error: "Meta.week_start is required." };
  }

  const supabase = await createClient();

  // Store the raw workbook (private bucket).
  const rawPath = `dashboard/${data.meta.weekStart}/${crypto.randomUUID()}.xlsx`;
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(rawPath, buffer, {
      contentType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
  if (upErr) {
    return { ok: false, error: `Storage upload failed: ${upErr.message}` };
  }

  // Insert the snapshot (keeps history; the dashboard reads the most recent).
  const { error: insErr } = await supabase.from("dashboard_snapshots").insert({
    week_start: data.meta.weekStart,
    data: data as never,
    uploaded_by: profile.id,
    task_id: taskId,
    raw_file_path: rawPath,
  });
  if (insErr) {
    // Roll back the orphaned raw file; store nothing on failure.
    await supabase.storage.from(BUCKET).remove([rawPath]);
    return { ok: false, error: insErr.message };
  }

  // Best-effort: attach the workbook to the linked task as an Excel attachment.
  if (taskId) {
    try {
      await uploadAttachment(taskId, profile.id, file);
    } catch {
      /* non-fatal */
    }
  }

  revalidatePath("/dashboard/weekly");
  return { ok: true, weekStart: data.meta.weekStart };
}
