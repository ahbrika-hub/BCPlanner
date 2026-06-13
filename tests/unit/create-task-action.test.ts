import { describe, it, expect, beforeEach, vi } from "vitest";

// createTaskAction must reject a project_id that isn't an ACTIVE project,
// mirroring the edit path's server-side rule (reusing isActiveProject).
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
const projects = vi.hoisted(() => ({ isActiveProject: vi.fn() }));

vi.mock("@/lib/auth/session", () => session);
vi.mock("@/lib/data/tasks", () => data);
vi.mock("@/lib/data/projects", () => projects);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/data/comments", () => ({ addComment: vi.fn() }));
vi.mock("@/lib/email/events", () => ({ emailRole: vi.fn(), emailUsers: vi.fn() }));

import { createTaskAction } from "@/lib/actions/tasks";

const PROJECT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

beforeEach(() => {
  vi.clearAllMocks();
  // section_head → status "assigned" (no pending-approval notify path)
  session.getCurrentProfile.mockResolvedValue({ id: "u1", role: "section_head" });
  session.getCurrentPermissions.mockResolvedValue(["tasks.create"]);
  data.createTask.mockResolvedValue({ id: "new", task_no: "TSS-BC-2026-0001", title: "T" });
  projects.isActiveProject.mockResolvedValue(true);
});

describe("createTaskAction active-project rule", () => {
  it("rejects a project-type task pointing at an INACTIVE project", async () => {
    projects.isActiveProject.mockResolvedValue(false);
    const res = await createTaskAction({
      title: "Valid title",
      task_category: "project",
      project_id: PROJECT_ID,
    });
    expect(res).toEqual({ ok: false, error: "Select an active project." });
    expect(projects.isActiveProject).toHaveBeenCalledWith(PROJECT_ID);
    expect(data.createTask).not.toHaveBeenCalled();
  });

  it("creates the task when the project is ACTIVE", async () => {
    const res = await createTaskAction({
      title: "Valid title",
      task_category: "project",
      project_id: PROJECT_ID,
    });
    expect(res.ok).toBe(true);
    const arg = data.createTask.mock.calls[0]![0];
    expect(arg).toMatchObject({
      project_id: PROJECT_ID,
      created_by: "u1",
      status: "assigned",
    });
  });

  it("does not active-check a department task and nulls any stray project_id", async () => {
    const res = await createTaskAction({
      title: "Valid title",
      task_category: "department",
      project_id: PROJECT_ID,
    });
    expect(res.ok).toBe(true);
    expect(projects.isActiveProject).not.toHaveBeenCalled();
    expect(data.createTask.mock.calls[0]![0].project_id).toBeNull();
  });
});
