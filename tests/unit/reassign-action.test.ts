import { describe, it, expect, beforeEach, vi } from "vitest";

// Drag-to-reassign must reuse the EXISTING assign action — same permission
// (tasks.assign) and transition guard — with NO new server path. The board calls
// transitionTaskAction(id, "assign", { assignee_id }); these tests prove the
// action's permission gate and that the affordance is permission-scoped.
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

vi.mock("@/lib/auth/session", () => session);
vi.mock("@/lib/data/tasks", () => data);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/data/comments", () => ({ addComment: vi.fn() }));
vi.mock("@/lib/email/events", () => ({ emailRole: vi.fn(), emailUsers: vi.fn() }));

import { transitionTaskAction } from "@/lib/actions/tasks";
import { ACTION_BY_NAME, getAvailableActions } from "@/lib/tasks/transitions";

beforeEach(() => {
  vi.clearAllMocks();
  session.getCurrentProfile.mockResolvedValue({ id: "mgr", role: "section_head" });
});

describe("drag-to-reassign uses the existing assign action", () => {
  it("the assign action is gated by tasks.assign and requires an assignee", () => {
    expect(ACTION_BY_NAME.assign.permission).toBe("tasks.assign");
    expect(ACTION_BY_NAME.assign.requires).toBe("assignee");
  });

  it("rejects a caller WITHOUT tasks.assign (same gate, no new path)", async () => {
    session.getCurrentPermissions.mockResolvedValue(["tasks.read"]); // no assign
    const res = await transitionTaskAction("task-1", "assign", {
      assignee_id: "u2",
    });
    expect(res).toEqual({ ok: false, error: "Not authorized." });
    // Rejected before any DB transition — guard/notifications untouched.
    expect(data.getTask).not.toHaveBeenCalled();
    expect(data.transitionTask).not.toHaveBeenCalled();
  });

  it("offers the assign affordance only to holders of tasks.assign", () => {
    expect(
      getAvailableActions("approved", "section_head", ["tasks.assign"]).some(
        (a) => a.action === "assign",
      ),
    ).toBe(true);
    expect(
      getAvailableActions("approved", "employee", ["tasks.read"]).some(
        (a) => a.action === "assign",
      ),
    ).toBe(false);
  });
});
