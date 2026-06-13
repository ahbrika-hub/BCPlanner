import { describe, it, expect, beforeEach, vi } from "vitest";

// Locks the PostgREST query the data layer builds for the new filters: multi
// status (.in), FTS+trigram search (.or), and the derived overdue conditions
// (.not is null / .lt / .not in). The RLS-scoped client is mocked.
const recorded = vi.hoisted(() => ({ calls: [] as Array<unknown[]> }));

function makeQuery() {
  const q: Record<string, unknown> = {};
  const passthrough =
    (name: string) =>
    (...args: unknown[]) => {
      recorded.calls.push([name, ...args]);
      return q;
    };
  q.select = passthrough("select");
  q.order = passthrough("order");
  q.in = passthrough("in");
  q.eq = passthrough("eq");
  q.or = passthrough("or");
  q.not = passthrough("not");
  q.lt = passthrough("lt");
  // Thenable: `await query` resolves to an empty success result.
  q.then = (resolve: (v: { data: unknown[]; error: null }) => void) =>
    resolve({ data: [], error: null });
  return q;
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ from: vi.fn(() => makeQuery()) })),
}));

import { listTasks } from "@/lib/data/tasks";

beforeEach(() => {
  recorded.calls = [];
});

function find(name: string) {
  return recorded.calls.filter((c) => c[0] === name);
}

describe("listTasks query construction", () => {
  it("filters multiple statuses via .in", async () => {
    await listTasks({ status: ["assigned", "in_progress"] });
    expect(find("in")).toContainEqual([
      "in",
      "status",
      ["assigned", "in_progress"],
    ]);
  });

  it("builds an FTS-OR-trigram search filter", async () => {
    await listTasks({ search: "TSS-BC-2026-0001" });
    const or = find("or");
    expect(or).toHaveLength(1);
    expect(or[0]?.[1]).toBe(
      "search_vector.wfts(simple).TSS-BC-2026-0001,task_no.ilike.*TSS-BC-2026-0001*",
    );
  });

  it("sanitizes PostgREST control characters out of the search term", async () => {
    await listTasks({ search: "road(map), %ok*" });
    const or = find("or");
    expect(or[0]?.[1]).toBe(
      "search_vector.wfts(simple).road map ok,task_no.ilike.*road map ok*",
    );
  });

  it("applies the canonical overdue conditions", async () => {
    await listTasks({ overdue: true });
    expect(find("not")).toContainEqual(["not", "due_date", "is", null]);
    expect(find("not")).toContainEqual([
      "not",
      "status",
      "in",
      "(completed,cancelled,rejected)",
    ]);
    expect(find("lt")).toHaveLength(1);
    expect(find("lt")[0]?.[1]).toBe("due_date");
  });

  it("omits status/search/overdue filters when not provided", async () => {
    await listTasks({});
    expect(find("in")).toHaveLength(0);
    expect(find("or")).toHaveLength(0);
    expect(find("lt")).toHaveLength(0);
  });
});
