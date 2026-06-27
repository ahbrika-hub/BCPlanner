import { describe, it, expect, beforeEach, vi } from "vitest";

// The parent-completion guard is application-layer (validate_task_transition is
// untouched). The ONLY entry into pending_review is transitionTaskAction with
// submit_review, so the check lives there. These tests prove: a parent with an
// OPEN child is refused submit_review (no status write); terminal children
// (completed/cancelled/rejected) never block (deadlock-avoidance); and a leaf /
// non-submit transition is unaffected.
const session = vi.hoisted(() => ({
  getCurrentProfile: vi.fn(),
  getCurrentPermissions: vi.fn(),
}));
const tasksData = vi.hoisted(() => ({
  getTask: vi.fn(),
  transitionTask: vi.fn(),
  createTask: vi.fn(),
  updateTask: vi.fn(),
  listOpenSubtasks: vi.fn(),
}));
const depsData = vi.hoisted(() => ({ listIncompleteBlockers: vi.fn() }));

vi.mock("@/lib/auth/session", () => session);
vi.mock("@/lib/data/tasks", () => tasksData);
vi.mock("@/lib/data/dependencies", () => depsData);
vi.mock("@/lib/data/projects", () => ({ isActiveProject: vi.fn() }));
vi.mock("@/lib/data/business-lines", () => ({ getGeneralBusinessLineId: vi.fn() }));
vi.mock("@/lib/data/comments", () => ({ addComment: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  // transitionTaskAction fires notifyForTransition (supabase.rpc) on success.
  createClient: vi.fn(async () => ({ rpc: vi.fn().mockResolvedValue({ data: null, error: null }) })),
}));
vi.mock("@/lib/email/events", () => ({ emailRole: vi.fn(), emailUsers: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { transitionTaskAction } from "@/lib/actions/tasks";
import { isOpenStatus, TERMINAL_STATUSES } from "@/lib/tasks/parent-guard";

const PARENT = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  vi.clearAllMocks();
  session.getCurrentProfile.mockResolvedValue({ id: "u1", role: "section_head" });
  session.getCurrentPermissions.mockResolvedValue(["tasks.submit_review"]);
  // A pending_review-eligible parent.
  tasksData.getTask.mockResolvedValue({
    id: PARENT,
    status: "in_progress",
    task_no: "TSS-BC-2026-0001",
    title: "Parent",
    created_by: "u1",
    assignee_id: "u1",
    category: null,
  });
  tasksData.transitionTask.mockResolvedValue({ id: PARENT });
  tasksData.listOpenSubtasks.mockResolvedValue([]);
  depsData.listIncompleteBlockers.mockResolvedValue([]);
});

describe("parent-completion guard (submit_review)", () => {
  it("REJECTS submit_review while a child is OPEN — status unchanged, no transition", async () => {
    tasksData.listOpenSubtasks.mockResolvedValue([
      { id: "c1", task_no: "TSS-BC-2026-0002", title: "child", status: "in_progress" },
    ]);

    const res = await transitionTaskAction(PARENT, "submit_review");

    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain("Has open subtasks: TSS-BC-2026-0002");
    expect(tasksData.transitionTask).not.toHaveBeenCalled();
  });

  it("lists EVERY open child in the message", async () => {
    tasksData.listOpenSubtasks.mockResolvedValue([
      { id: "c1", task_no: "TSS-BC-2026-0002", title: "a", status: "assigned" },
      { id: "c2", task_no: "TSS-BC-2026-0003", title: "b", status: "pending_update" },
    ]);
    const res = await transitionTaskAction(PARENT, "submit_review");
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toContain("TSS-BC-2026-0002");
      expect(res.error).toContain("TSS-BC-2026-0003");
    }
  });

  it("ALLOWS submit_review when all children are terminal (none returned as open)", async () => {
    tasksData.listOpenSubtasks.mockResolvedValue([]); // completed/cancelled/rejected filtered out
    const res = await transitionTaskAction(PARENT, "submit_review");
    expect(res.ok).toBe(true);
    expect(tasksData.transitionTask).toHaveBeenCalledWith(PARENT, "pending_review", {});
  });

  it("ALLOWS submit_review for a leaf task (no children)", async () => {
    tasksData.listOpenSubtasks.mockResolvedValue([]);
    const res = await transitionTaskAction(PARENT, "submit_review");
    expect(res.ok).toBe(true);
    expect(tasksData.transitionTask).toHaveBeenCalledTimes(1);
  });

  it("does NOT apply the open-children check to a non-submit transition (cancel)", async () => {
    session.getCurrentPermissions.mockResolvedValue(["tasks.cancel"]);
    tasksData.listOpenSubtasks.mockResolvedValue([
      { id: "c1", task_no: "TSS-BC-2026-0002", title: "child", status: "in_progress" },
    ]);
    const res = await transitionTaskAction(PARENT, "cancel");
    expect(res.ok).toBe(true);
    expect(tasksData.transitionTask).toHaveBeenCalledWith(PARENT, "cancelled", {});
    // The parent-children query is only consulted for pending_review.
    expect(tasksData.listOpenSubtasks).not.toHaveBeenCalled();
  });
});

describe("terminal-status contract (deadlock-avoidance)", () => {
  it("treats exactly completed/cancelled/rejected as terminal", () => {
    expect([...TERMINAL_STATUSES].sort()).toEqual(
      ["cancelled", "completed", "rejected"].sort(),
    );
  });

  it("cancelled and rejected children are NOT open (can't deadlock the parent)", () => {
    expect(isOpenStatus("cancelled")).toBe(false);
    expect(isOpenStatus("rejected")).toBe(false);
    expect(isOpenStatus("completed")).toBe(false);
    expect(isOpenStatus("in_progress")).toBe(true);
    expect(isOpenStatus("assigned")).toBe(true);
  });
});
