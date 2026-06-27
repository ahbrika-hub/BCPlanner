import { describe, it, expect, beforeEach, vi } from "vitest";

// The create-task assignee-workload action must return AGGREGATES ONLY (no task
// titles/ids) and reuse the windowed workload math from PR 2.
const session = vi.hoisted(() => ({
  getCurrentProfile: vi.fn(),
  getCurrentPermissions: vi.fn(),
}));
const tasksResult = vi.hoisted(() => ({ value: { data: [] as unknown[], error: null as unknown } }));

vi.mock("@/lib/auth/session", () => session);
vi.mock("@/lib/supabase/server", () => {
  const thenable = (value: unknown) => {
    const q: Record<string, unknown> = {};
    for (const m of ["select", "eq", "in", "neq", "gte", "lte"])
      q[m] = vi.fn(() => q);
    (q as { then: unknown }).then = (resolve: (v: unknown) => void) =>
      resolve(value);
    return q;
  };
  return {
    createClient: vi.fn(async () => ({
      // public_holidays → no holidays in tests; any other table → tasks result.
      from: vi.fn((table: string) =>
        table === "public_holidays"
          ? thenable({ data: [], error: null })
          : thenable(tasksResult.value),
      ),
    })),
  };
});

import { getAssigneeWorkloadAction } from "@/lib/actions/assignee-workload";

const ASSIGNEE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

beforeEach(() => {
  vi.clearAllMocks();
  session.getCurrentProfile.mockResolvedValue({ id: "creator", role: "section_head" });
  session.getCurrentPermissions.mockResolvedValue(["tasks.create"]);
  tasksResult.value = { data: [], error: null };
});

describe("getAssigneeWorkloadAction", () => {
  it("returns ONLY aggregate fields — never task titles/ids (privacy)", async () => {
    tasksResult.value = {
      data: [
        // titles/ids present in the source row must NOT leak into the result
        { id: "t1", title: "Secret task A", estimated_effort_hours: 10, start_date: "2026-06-10", due_date: "2026-06-12", created_at: "2026-06-10T00:00:00Z" },
        { id: "t2", title: "Secret task B", estimated_effort_hours: 4, start_date: "2026-06-01", due_date: "2026-06-09", created_at: "2026-06-01T00:00:00Z" },
        { id: "t3", title: "Out of range", estimated_effort_hours: 99, start_date: "2026-06-20", due_date: "2026-06-25", created_at: "2026-06-20T00:00:00Z" },
      ],
      error: null,
    };
    const res = await getAssigneeWorkloadAction({
      assigneeId: ASSIGNEE,
      from: "2026-06-08",
      to: "2026-06-14",
    });
    expect(res).not.toBeNull();
    // aggregate math: 2 in-range tasks, 14h; 06-08→06-14 = 5 working days (Sun–Thu)
    // → 40h capacity (Fri 06-12 + Sat 06-13 excluded), util 14/40*100 = 35%.
    expect(res).toEqual({
      active_task_count: 2,
      total_estimated_hours: 14,
      capacity_hours: 40,
      utilization_pct: 35,
      workload_level: "low",
    });
    // exact key allowlist — no id/title/details
    expect(Object.keys(res!).sort()).toEqual([
      "active_task_count",
      "capacity_hours",
      "total_estimated_hours",
      "utilization_pct",
      "workload_level",
    ]);
    expect(JSON.stringify(res)).not.toContain("Secret");
  });

  it("denies when the caller lacks tasks.create", async () => {
    session.getCurrentPermissions.mockResolvedValue([]);
    const res = await getAssigneeWorkloadAction({
      assigneeId: ASSIGNEE,
      from: "2026-06-08",
      to: "2026-06-14",
    });
    expect(res).toBeNull();
  });

  it("rejects invalid input (bad uuid / dates) before any query", async () => {
    expect(await getAssigneeWorkloadAction({ assigneeId: "nope", from: "x", to: "y" })).toBeNull();
    expect(await getAssigneeWorkloadAction(null)).toBeNull();
  });
});
