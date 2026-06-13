import { describe, it, expect, beforeEach, vi } from "vitest";

// Locks the dashboard overdue widget's drill-down query to the CANONICAL
// predicate: a non-null past due date and a non-terminal status, where terminal
// now includes 'rejected' (previously only completed/cancelled — the drift this
// fixes). Keeps the widget count and its drill-down list on one definition.
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
  q.eq = passthrough("eq");
  q.not = passthrough("not");
  q.lt = passthrough("lt");
  q.limit = passthrough("limit");
  q.then = (resolve: (v: { data: unknown[]; error: null }) => void) =>
    resolve({ data: [], error: null });
  return q;
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ from: vi.fn(() => makeQuery()) })),
}));

import { getOverdueTasks } from "@/lib/data/analytics";

beforeEach(() => {
  recorded.calls = [];
});

function find(name: string) {
  return recorded.calls.filter((c) => c[0] === name);
}

describe("getOverdueTasks query (canonical overdue)", () => {
  it("filters non-null past-due, non-terminal rows including 'rejected'", async () => {
    await getOverdueTasks();
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
});
