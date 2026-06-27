import { describe, it, expect, beforeEach, vi } from "vitest";

// Generating a project from a template MUST reuse the existing creation actions
// (createProjectAction + createTaskAction), never a bulk insert. These tests
// prove the orchestration calls those actions, once per task, with the project
// link — and that the projects.manage gate + partial-failure reporting hold.
const session = vi.hoisted(() => ({
  getCurrentProfile: vi.fn(),
  getCurrentPermissions: vi.fn(),
}));
const projects = vi.hoisted(() => ({ createProjectAction: vi.fn() }));
const tasks = vi.hoisted(() => ({ createTaskAction: vi.fn() }));
const data = vi.hoisted(() => ({
  getProjectTemplate: vi.fn(),
  createProjectTemplate: vi.fn(),
  updateProjectTemplate: vi.fn(),
  deleteProjectTemplate: vi.fn(),
  setTemplateTasks: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => session);
vi.mock("@/lib/actions/projects", () => projects);
vi.mock("@/lib/actions/tasks", () => tasks);
vi.mock("@/lib/data/project-templates", () => data);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { createProjectFromTemplateAction } from "@/lib/actions/project-templates";

const TEMPLATE_ID = "11111111-1111-4111-8111-111111111111";

function defs(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    id: `d${i}`,
    template_id: TEMPLATE_ID,
    title: `Task ${i + 1}`,
    description: null,
    priority: "high" as const,
    business_line_id: null,
    estimated_effort_hours: null,
    position: i,
    created_at: "",
    updated_at: "",
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
  session.getCurrentProfile.mockResolvedValue({ id: "mgr", role: "section_head" });
  session.getCurrentPermissions.mockResolvedValue(["projects.manage"]);
  data.getProjectTemplate.mockResolvedValue({
    id: TEMPLATE_ID,
    name: "Onboarding",
    is_active: true,
    tasks: defs(3),
  });
  projects.createProjectAction.mockResolvedValue({ ok: true, id: "proj-1" });
  tasks.createTaskAction.mockResolvedValue({ ok: true, id: "task-x" });
});

describe("createProjectFromTemplateAction (generation reuse)", () => {
  it("creates the project once and generates exactly N tasks via createTaskAction", async () => {
    const res = await createProjectFromTemplateAction({
      template_id: TEMPLATE_ID,
      name: "Client A onboarding",
    });
    expect(res).toEqual({ ok: true, projectId: "proj-1", createdCount: 3 });
    expect(projects.createProjectAction).toHaveBeenCalledTimes(1);
    expect(tasks.createTaskAction).toHaveBeenCalledTimes(3);
    // Every generated task goes through the real action with the project link.
    for (const call of tasks.createTaskAction.mock.calls) {
      expect(call[0]).toMatchObject({
        task_category: "project",
        project_id: "proj-1",
      });
    }
  });

  it("is denied without projects.manage (no project, no tasks created)", async () => {
    session.getCurrentPermissions.mockResolvedValue(["projects.read"]);
    const res = await createProjectFromTemplateAction({
      template_id: TEMPLATE_ID,
      name: "Nope",
    });
    expect(res).toMatchObject({ ok: false });
    expect(projects.createProjectAction).not.toHaveBeenCalled();
    expect(tasks.createTaskAction).not.toHaveBeenCalled();
  });

  it("reports partial failure without hiding the half-built project", async () => {
    tasks.createTaskAction
      .mockResolvedValueOnce({ ok: true, id: "t1" })
      .mockResolvedValueOnce({ ok: false, error: "boom" })
      .mockResolvedValueOnce({ ok: true, id: "t3" });
    const res = await createProjectFromTemplateAction({
      template_id: TEMPLATE_ID,
      name: "Partial",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.projectId).toBe("proj-1");
      expect(res.createdCount).toBe(2);
      expect(res.error).toContain("1 of 3");
    }
  });
});
