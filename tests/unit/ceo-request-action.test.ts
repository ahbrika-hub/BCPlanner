import { describe, it, expect, beforeEach, vi } from "vitest";

// PART A: a CEO "Request a task" must land pending_approval, UNASSIGNED, with
// created_by = the CEO and the soft fields defaulted (priority medium, department
// category, the "General" business line). It reuses createTaskAction.
const session = vi.hoisted(() => ({
  getCurrentProfile: vi.fn(),
  getCurrentPermissions: vi.fn(),
}));
const data = vi.hoisted(() => ({
  createTask: vi.fn(),
  updateTask: vi.fn(),
  getTask: vi.fn(),
  transitionTask: vi.fn(),
}));
const lines = vi.hoisted(() => ({ getGeneralBusinessLineId: vi.fn() }));

vi.mock("@/lib/auth/session", () => session);
vi.mock("@/lib/data/tasks", () => data);
vi.mock("@/lib/data/projects", () => ({ isActiveProject: vi.fn() }));
vi.mock("@/lib/data/business-lines", () => lines);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ rpc: vi.fn() })),
}));
vi.mock("@/lib/data/comments", () => ({ addComment: vi.fn() }));
vi.mock("@/lib/email/events", () => ({ emailRole: vi.fn(), emailUsers: vi.fn() }));

import { requestTaskAction } from "@/lib/actions/tasks";

const GENERAL = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

beforeEach(() => {
  vi.clearAllMocks();
  session.getCurrentProfile.mockResolvedValue({ id: "ceo-1", role: "ceo" });
  session.getCurrentPermissions.mockResolvedValue(["tasks.create"]);
  lines.getGeneralBusinessLineId.mockResolvedValue(GENERAL);
  data.createTask.mockResolvedValue({
    id: "new",
    task_no: "TSS-BC-2026-0009",
    title: "Prepare board summary",
  });
});

describe("requestTaskAction (CEO lightweight request)", () => {
  it("creates a pending_approval, unassigned task owned by the CEO with defaults", async () => {
    const res = await requestTaskAction("Prepare board summary");
    expect(res.ok).toBe(true);

    const arg = data.createTask.mock.calls[0]![0];
    expect(arg).toMatchObject({
      title: "Prepare board summary",
      status: "pending_approval",
      created_by: "ceo-1",
      priority: "medium",
      task_category: "department",
      business_line_id: GENERAL,
    });
    // unassigned: the action never sets an assignee
    expect(arg.assignee_id).toBeUndefined();
  });

  it("rejects an empty / too-short request before hitting the data layer", async () => {
    const res = await requestTaskAction("  ");
    expect(res.ok).toBe(false);
    expect(data.createTask).not.toHaveBeenCalled();
  });
});
