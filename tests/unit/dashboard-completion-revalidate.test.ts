import { describe, it, expect, beforeEach, vi } from "vitest";

// PR-D2 item 2: completing a "Dashboard Update" task (pending_review → completed)
// revalidates the weekly dashboard; completing any other task does not.
const session = vi.hoisted(() => ({
  getCurrentProfile: vi.fn(),
  getCurrentPermissions: vi.fn(),
}));
const data = vi.hoisted(() => ({
  getTask: vi.fn(),
  transitionTask: vi.fn(),
  createTask: vi.fn(),
  updateTask: vi.fn(),
}));
const cache = vi.hoisted(() => ({ revalidatePath: vi.fn() }));

vi.mock("@/lib/auth/session", () => session);
vi.mock("@/lib/data/tasks", () => data);
vi.mock("next/cache", () => cache);
vi.mock("@/lib/data/comments", () => ({ addComment: vi.fn() }));
vi.mock("@/lib/email/events", () => ({ emailRole: vi.fn(), emailUsers: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  // notifyForTransition uses supabase.rpc(create_notification)
  createClient: vi.fn(async () => ({ rpc: vi.fn(async () => ({ error: null })) })),
}));

import { transitionTaskAction } from "@/lib/actions/tasks";

const CLOSURE = { closure_summary: "Done", quality_rating: 5 };

function baseTask(category: string) {
  return {
    id: "task-1",
    task_no: "TSS-BC-2026-0001",
    title: "Weekly upload",
    status: "pending_review",
    category,
    created_by: "creator-1",
    assignee_id: "assignee-1",
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  session.getCurrentProfile.mockResolvedValue({ id: "mgr-1", role: "section_head" });
  session.getCurrentPermissions.mockResolvedValue(["tasks.close"]);
  data.transitionTask.mockResolvedValue({ id: "task-1" });
});

describe("transitionTaskAction → weekly dashboard revalidation", () => {
  it("revalidates /dashboard/weekly when a Dashboard Update task is completed", async () => {
    data.getTask.mockResolvedValue(baseTask("Dashboard Update"));
    const res = await transitionTaskAction("task-1", "close", CLOSURE);
    expect(res.ok).toBe(true);
    const paths = cache.revalidatePath.mock.calls.map((c) => c[0]);
    expect(paths).toContain("/dashboard/weekly");
    expect(paths).toContain("/dashboard");
  });

  it("does NOT revalidate the dashboard when a non-dashboard task is completed", async () => {
    data.getTask.mockResolvedValue(baseTask("General"));
    const res = await transitionTaskAction("task-1", "close", CLOSURE);
    expect(res.ok).toBe(true);
    const paths = cache.revalidatePath.mock.calls.map((c) => c[0]);
    expect(paths).not.toContain("/dashboard/weekly");
    // …but the normal task revalidations still happen.
    expect(paths).toContain("/tasks");
  });
});
