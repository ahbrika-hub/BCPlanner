import { describe, it, expect, beforeEach, vi } from "vitest";

// fetchDrilldownTasks must map the project-health metric keys to the right
// project-scoped listTasks filters, and keep the #61 role-scoping (ceo → none).
const session = vi.hoisted(() => ({ getCurrentProfile: vi.fn() }));
const data = vi.hoisted(() => ({ listTasks: vi.fn() }));
const analytics = vi.hoisted(() => ({ getOverdueTasks: vi.fn() }));

vi.mock("@/lib/auth/session", () => session);
vi.mock("@/lib/data/tasks", () => data);
vi.mock("@/lib/data/analytics", () => analytics);

import { fetchDrilldownTasks } from "@/lib/actions/dashboard-drilldown";

const PROJECT = "11111111-1111-4111-8111-111111111111";
const row = {
  id: "t1",
  title: "T",
  status: "in_progress",
  due_date: null,
  estimated_effort_hours: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  session.getCurrentProfile.mockResolvedValue({ id: "mgr", role: "section_head" });
  data.listTasks.mockResolvedValue([row]);
});

describe("fetchDrilldownTasks — project-health keys", () => {
  it("project-total → listTasks filtered by project_id (manager: no assignee scope)", async () => {
    const out = await fetchDrilldownTasks({ kind: "project-total", projectId: PROJECT });
    expect(data.listTasks).toHaveBeenCalledWith({
      project_id: PROJECT,
      assignee_id: undefined,
    });
    expect(out).toHaveLength(1);
  });

  it("project-status → project_id + the single status", async () => {
    await fetchDrilldownTasks({ kind: "project-status", projectId: PROJECT, status: "completed" });
    expect(data.listTasks).toHaveBeenCalledWith({
      project_id: PROJECT,
      status: ["completed"],
      assignee_id: undefined,
    });
  });

  it("project-overdue → project_id + the derived overdue filter", async () => {
    await fetchDrilldownTasks({ kind: "project-overdue", projectId: PROJECT });
    expect(data.listTasks).toHaveBeenCalledWith({
      project_id: PROJECT,
      overdue: true,
      assignee_id: undefined,
    });
  });

  it("employee is scoped to their OWN project tasks (defence-in-depth)", async () => {
    session.getCurrentProfile.mockResolvedValue({ id: "emp", role: "employee" });
    await fetchDrilldownTasks({ kind: "project-total", projectId: PROJECT });
    expect(data.listTasks).toHaveBeenCalledWith({
      project_id: PROJECT,
      assignee_id: "emp",
    });
  });

  it("ceo gets NO project drill-down (consistent with #61) — no query", async () => {
    session.getCurrentProfile.mockResolvedValue({ id: "ceo", role: "ceo" });
    const out = await fetchDrilldownTasks({ kind: "project-overdue", projectId: PROJECT });
    expect(out).toEqual([]);
    expect(data.listTasks).not.toHaveBeenCalled();
  });
});
