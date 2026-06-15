import { describe, it, expect, beforeEach, vi } from "vitest";

// Req 1: an employee drilling into THEIR personal-dashboard metrics must see only
// their OWN tasks; managers see all; ceo sees none. The scoping lives in the
// server action (the trust boundary), driven by getDrilldownScope.
const session = vi.hoisted(() => ({ getCurrentProfile: vi.fn() }));
const data = vi.hoisted(() => ({ listTasks: vi.fn() }));
const analytics = vi.hoisted(() => ({ getOverdueTasks: vi.fn() }));

vi.mock("@/lib/auth/session", () => session);
vi.mock("@/lib/data/tasks", () => data);
vi.mock("@/lib/data/analytics", () => analytics);

import { fetchDrilldownTasks } from "@/lib/actions/dashboard-drilldown";

beforeEach(() => {
  vi.clearAllMocks();
  data.listTasks.mockResolvedValue([]);
  analytics.getOverdueTasks.mockResolvedValue([
    { id: "o1", title: "mine", status: "assigned", due_date: "2026-01-01", estimated_effort_hours: null, assignee_id: "emp" },
    { id: "o2", title: "theirs", status: "assigned", due_date: "2026-01-01", estimated_effort_hours: null, assignee_id: "other" },
  ]);
});

describe("personal dashboard drill-down scoping (employee → own)", () => {
  it("employee 'active' / 'status' keys pass assignee_id = self", async () => {
    session.getCurrentProfile.mockResolvedValue({ id: "emp", role: "employee" });
    await fetchDrilldownTasks({ kind: "active" });
    expect(data.listTasks).toHaveBeenCalledWith(
      expect.objectContaining({ assignee_id: "emp" }),
    );
    await fetchDrilldownTasks({ kind: "status", status: "completed" });
    expect(data.listTasks).toHaveBeenLastCalledWith({
      status: ["completed"],
      assignee_id: "emp",
    });
  });

  it("employee 'overdue' is filtered to their own rows", async () => {
    session.getCurrentProfile.mockResolvedValue({ id: "emp", role: "employee" });
    const out = await fetchDrilldownTasks({ kind: "overdue" });
    expect(out.map((t) => t.id)).toEqual(["o1"]); // only the employee's own overdue
  });

  it("manager (section_head) is NOT assignee-scoped", async () => {
    session.getCurrentProfile.mockResolvedValue({ id: "sh", role: "section_head" });
    await fetchDrilldownTasks({ kind: "active" });
    expect(data.listTasks).toHaveBeenCalledWith(
      expect.objectContaining({ assignee_id: undefined }),
    );
  });

  it("ceo gets nothing (no query)", async () => {
    session.getCurrentProfile.mockResolvedValue({ id: "ceo", role: "ceo" });
    expect(await fetchDrilldownTasks({ kind: "active" })).toEqual([]);
    expect(data.listTasks).not.toHaveBeenCalled();
  });
});
