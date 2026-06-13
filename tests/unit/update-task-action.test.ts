import { describe, it, expect, beforeEach, vi } from "vitest";

// Proves the edit path (updateTaskAction) enforces, at the app layer:
//   1. Eligibility mirrors the tasks_update RLS policy exactly — creator,
//      current assignee, or a manager (tasks.read_all); ceo and unrelated
//      employees are refused.
//   2. The create validation is reused verbatim (https-only SharePoint link;
//      a project is required for project-type tasks).
//   3. Only descriptive metadata is written — status and assignee can never be
//      set via an edit, and switching to "department" clears project_id.
//   4. A project-type edit must point at an ACTIVE project.

const session = vi.hoisted(() => ({
  getCurrentProfile: vi.fn(),
  getCurrentPermissions: vi.fn(),
}));
const data = vi.hoisted(() => ({
  getTask: vi.fn(),
  updateTask: vi.fn(),
  createTask: vi.fn(),
  transitionTask: vi.fn(),
}));
const projects = vi.hoisted(() => ({ isActiveProject: vi.fn() }));

vi.mock("@/lib/auth/session", () => session);
vi.mock("@/lib/data/tasks", () => data);
vi.mock("@/lib/data/projects", () => projects);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/data/comments", () => ({ addComment: vi.fn() }));
vi.mock("@/lib/email/events", () => ({
  emailRole: vi.fn(),
  emailUsers: vi.fn(),
}));

import { updateTaskAction } from "@/lib/actions/tasks";

const PROJECT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const BUSINESS_LINE_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const EXISTING = {
  id: "task-1",
  created_by: "creator-1",
  assignee_id: "assignee-1",
};

function asUser(id: string, permissions: string[]) {
  session.getCurrentProfile.mockResolvedValue({ id, role: "employee" });
  session.getCurrentPermissions.mockResolvedValue(permissions);
}

beforeEach(() => {
  vi.clearAllMocks();
  data.getTask.mockResolvedValue(EXISTING);
  data.updateTask.mockResolvedValue({ ...EXISTING });
  projects.isActiveProject.mockResolvedValue(true);
});

const validDept = { title: "A valid title", task_category: "department" };

describe("updateTaskAction eligibility (mirrors tasks_update RLS)", () => {
  it("allows the task creator", async () => {
    asUser("creator-1", ["tasks.update"]);
    const res = await updateTaskAction("task-1", validDept);
    expect(res.ok).toBe(true);
    expect(data.updateTask).toHaveBeenCalledTimes(1);
  });

  it("allows the current assignee", async () => {
    asUser("assignee-1", ["tasks.update"]);
    const res = await updateTaskAction("task-1", validDept);
    expect(res.ok).toBe(true);
    expect(data.updateTask).toHaveBeenCalledTimes(1);
  });

  it("allows a manager (tasks.read_all) who is neither creator nor assignee", async () => {
    asUser("manager-1", ["tasks.update", "tasks.read_all"]);
    const res = await updateTaskAction("task-1", validDept);
    expect(res.ok).toBe(true);
    expect(data.updateTask).toHaveBeenCalledTimes(1);
  });

  it("refuses an unrelated employee (has tasks.update, no read_all)", async () => {
    asUser("other-1", ["tasks.update"]);
    const res = await updateTaskAction("task-1", validDept);
    expect(res.ok).toBe(false);
    expect(data.updateTask).not.toHaveBeenCalled();
  });

  it("refuses ceo (read-only: read_all but no tasks.update)", async () => {
    asUser("ceo-1", ["tasks.read_all"]);
    const res = await updateTaskAction("task-1", validDept);
    expect(res).toEqual({ ok: false, error: "Not authorized." });
    expect(data.getTask).not.toHaveBeenCalled();
    expect(data.updateTask).not.toHaveBeenCalled();
  });
});

describe("updateTaskAction validation (reused from create)", () => {
  it("rejects a non-https SharePoint link", async () => {
    asUser("creator-1", ["tasks.update"]);
    const res = await updateTaskAction("task-1", {
      ...validDept,
      sharepoint_url: "http://insecure.example.com/doc",
    });
    expect(res.ok).toBe(false);
    expect(data.updateTask).not.toHaveBeenCalled();
  });

  it("rejects a project-type task with no project selected", async () => {
    asUser("creator-1", ["tasks.update"]);
    const res = await updateTaskAction("task-1", {
      title: "A valid title",
      task_category: "project",
    });
    expect(res.ok).toBe(false);
    expect(data.updateTask).not.toHaveBeenCalled();
  });

  it("rejects a project-type task pointing at an INACTIVE project", async () => {
    asUser("creator-1", ["tasks.update"]);
    projects.isActiveProject.mockResolvedValue(false);
    const res = await updateTaskAction("task-1", {
      title: "A valid title",
      task_category: "project",
      project_id: PROJECT_ID,
    });
    expect(res).toEqual({ ok: false, error: "Select an active project." });
    expect(data.updateTask).not.toHaveBeenCalled();
  });

  it("accepts a project-type task pointing at an ACTIVE project", async () => {
    asUser("creator-1", ["tasks.update"]);
    const res = await updateTaskAction("task-1", {
      title: "A valid title",
      task_category: "project",
      project_id: PROJECT_ID,
    });
    expect(res.ok).toBe(true);
    expect(projects.isActiveProject).toHaveBeenCalledWith(PROJECT_ID);
    const patch = data.updateTask.mock.calls[0]![1];
    expect(patch.project_id).toBe(PROJECT_ID);
    expect(patch.task_category).toBe("project");
  });
});

describe("updateTaskAction writes a descriptive-only allowlist", () => {
  it("clears project_id when switching to department even if one is supplied", async () => {
    asUser("creator-1", ["tasks.update"]);
    const res = await updateTaskAction("task-1", {
      title: "A valid title",
      task_category: "department",
      project_id: PROJECT_ID,
    });
    expect(res.ok).toBe(true);
    const patch = data.updateTask.mock.calls[0]![1];
    expect(patch.project_id).toBeNull();
    // A department edit must not trip the active-project lookup.
    expect(projects.isActiveProject).not.toHaveBeenCalled();
  });

  it("never writes status or assignee_id, even when present in the payload", async () => {
    asUser("creator-1", ["tasks.update"]);
    const res = await updateTaskAction("task-1", {
      title: "A valid title",
      task_category: "department",
      business_line_id: BUSINESS_LINE_ID,
      sharepoint_url: "https://contoso.sharepoint.com/doc",
      status: "completed",
      assignee_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    });
    expect(res.ok).toBe(true);
    const patch = data.updateTask.mock.calls[0]![1];
    expect(patch).not.toHaveProperty("status");
    expect(patch).not.toHaveProperty("assignee_id");
    expect(patch.title).toBe("A valid title");
    expect(patch.business_line_id).toBe(BUSINESS_LINE_ID);
    expect(patch.sharepoint_url).toBe("https://contoso.sharepoint.com/doc");
  });
});
