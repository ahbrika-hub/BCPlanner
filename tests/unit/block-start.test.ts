import { describe, it, expect, beforeEach, vi } from "vitest";

// The block-START rule is enforced in the APPLICATION layer (addUpdateAction),
// not the DB guard. A task enters in_progress ONLY via logging progress (the
// apply_task_update trigger advances assigned/approved/pending_update). These
// tests prove addUpdateAction refuses to START a task with incomplete blockers,
// across every startable status, lets it through once blockers complete, and
// never blocks a non-start update.
const session = vi.hoisted(() => ({
  getCurrentProfile: vi.fn(),
  getCurrentPermissions: vi.fn(),
}));
const tasksData = vi.hoisted(() => ({ getTask: vi.fn() }));
const updatesData = vi.hoisted(() => ({ addUpdate: vi.fn() }));
const depsData = vi.hoisted(() => ({ listIncompleteBlockers: vi.fn() }));

vi.mock("@/lib/auth/session", () => session);
vi.mock("@/lib/data/tasks", () => tasksData);
vi.mock("@/lib/data/task-updates", () => updatesData);
vi.mock("@/lib/data/dependencies", () => depsData);
vi.mock("@/lib/data/comments", () => ({ addComment: vi.fn(), markAddressed: vi.fn() }));
vi.mock("@/lib/data/attachments", () => ({
  uploadAttachment: vi.fn(),
  deleteAttachment: vi.fn(),
  getAttachmentSignedUrl: vi.fn(),
  getAttachmentByStoragePath: vi.fn(),
  getAttachmentById: vi.fn(),
  MAX_ATTACHMENT_BYTES: 1,
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { addUpdateAction } from "@/lib/actions/collaboration";
import { STARTABLE_STATUSES } from "@/lib/tasks/dependencies";

const VALID_UPDATE = { progress_percentage: 25 };
const ONE_BLOCKER = [{ task_no: "TSS-BC-2026-0001", title: "A", status: "assigned" as const }];

beforeEach(() => {
  vi.clearAllMocks();
  session.getCurrentProfile.mockResolvedValue({ id: "u1", role: "employee" });
  session.getCurrentPermissions.mockResolvedValue(["task_updates.create"]);
  updatesData.addUpdate.mockResolvedValue({ id: "upd1" });
  depsData.listIncompleteBlockers.mockResolvedValue([]);
});

describe("block-START in addUpdateAction", () => {
  it.each(STARTABLE_STATUSES)(
    "REJECTS starting a %s task with an incomplete blocker (status unchanged, no update written)",
    async (status) => {
      tasksData.getTask.mockResolvedValue({ id: "B", status });
      depsData.listIncompleteBlockers.mockResolvedValue(ONE_BLOCKER);

      const res = await addUpdateAction("B", VALID_UPDATE);

      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error).toContain("Blocked by TSS-BC-2026-0001");
      // Crucially: no progress update was inserted, so the trigger never runs and
      // the status cannot advance to in_progress.
      expect(updatesData.addUpdate).not.toHaveBeenCalled();
    },
  );

  it("ALLOWS starting once every blocker is completed", async () => {
    tasksData.getTask.mockResolvedValue({ id: "B", status: "assigned" });
    depsData.listIncompleteBlockers.mockResolvedValue([]); // all completed

    const res = await addUpdateAction("B", VALID_UPDATE);

    expect(res.ok).toBe(true);
    expect(updatesData.addUpdate).toHaveBeenCalledTimes(1);
  });

  it("does NOT block a progress update on an already in_progress task (not a start)", async () => {
    tasksData.getTask.mockResolvedValue({ id: "B", status: "in_progress" });
    depsData.listIncompleteBlockers.mockResolvedValue(ONE_BLOCKER);

    const res = await addUpdateAction("B", VALID_UPDATE);

    expect(res.ok).toBe(true);
    expect(updatesData.addUpdate).toHaveBeenCalledTimes(1);
    // The blocker check is skipped entirely for non-start statuses.
    expect(depsData.listIncompleteBlockers).not.toHaveBeenCalled();
  });

  it("in_progress is NOT a startable status (entered via the progress-log trigger)", () => {
    expect(STARTABLE_STATUSES).toEqual(["assigned", "approved", "pending_update"]);
    expect(STARTABLE_STATUSES).not.toContain("in_progress");
  });
});
