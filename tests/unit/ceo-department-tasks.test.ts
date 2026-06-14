import { describe, it, expect, vi } from "vitest";

// PART B: the CEO oversight data source must NOT expose assignee identity. Even
// if the underlying row carried assignee fields, getCeoDepartmentTasks maps to
// an explicit allowlist that omits them.
const rpc = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ rpc })),
}));

import { getCeoDepartmentTasks } from "@/lib/data/tasks";

describe("getCeoDepartmentTasks (CEO oversight)", () => {
  it("returns dept tasks with no assignee identity, flagging own requests", async () => {
    rpc.mockResolvedValue({
      data: [
        {
          id: "t1",
          task_no: "TSS-BC-2026-0001",
          title: "Fleet summary",
          status: "in_progress",
          priority: "high",
          business_line: "General",
          due_date: "2026-07-01",
          created_at: "2026-06-01T00:00:00Z",
          is_my_request: true,
          // Sneaky assignee fields that must NOT survive the mapping:
          assignee_id: "leak-uuid",
          assignee_name: "Should Not Appear",
        },
      ],
      error: null,
    });

    const rows = await getCeoDepartmentTasks();
    expect(rpc).toHaveBeenCalledWith("get_ceo_department_tasks");
    expect(rows).toHaveLength(1);

    const row = rows[0]!;
    expect(row.is_my_request).toBe(true);
    expect(row.business_line).toBe("General");
    // No assignee identity leaks through:
    expect(Object.keys(row)).not.toContain("assignee_id");
    expect(Object.keys(row)).not.toContain("assignee_name");
    expect(Object.keys(row)).not.toContain("assignee");
    expect(JSON.stringify(row)).not.toContain("leak-uuid");
    expect(JSON.stringify(row)).not.toContain("Should Not Appear");
  });
});
