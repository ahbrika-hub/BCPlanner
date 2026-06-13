import { describe, it, expect, beforeEach, vi } from "vitest";

// Proves the timeline aggregation reads all four history sources through the
// RLS-scoped SESSION client (@/lib/supabase/server createClient — NOT a
// service-role client), and that the audit source is keyed by entity_type/
// entity_id. Because every read goes through this session client, each table's
// RLS applies and a viewer only gets rows they may see.
const recorded = vi.hoisted(() => ({
  tables: [] as string[],
  eqs: [] as Array<[string, unknown]>,
  createCalls: 0,
}));

function makeBuilder() {
  const b: Record<string, unknown> = {};
  const pass =
    () =>
    (...args: unknown[]) => {
      void args;
      return b;
    };
  b.select = pass();
  b.order = pass();
  b.limit = pass();
  b.lte = pass();
  b.eq = (col: string, val: unknown) => {
    recorded.eqs.push([col, val]);
    return b;
  };
  // Thenable: awaiting the built query resolves to an empty success result.
  b.then = (resolve: (v: { data: unknown[]; error: null }) => void) =>
    resolve({ data: [], error: null });
  return b;
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => {
    recorded.createCalls += 1;
    return {
      from: (table: string) => {
        recorded.tables.push(table);
        return makeBuilder();
      },
    };
  }),
}));

import { getTaskTimeline } from "@/lib/data/timeline";

beforeEach(() => {
  recorded.tables = [];
  recorded.eqs = [];
  recorded.createCalls = 0;
});

describe("getTaskTimeline reads all sources under the session client", () => {
  it("queries the four history tables", async () => {
    await getTaskTimeline("task-1");
    expect(recorded.createCalls).toBe(1); // single RLS-scoped session client
    expect(recorded.tables).toEqual(
      expect.arrayContaining([
        "task_updates",
        "task_comments",
        "task_attachments",
        "audit_logs",
      ]),
    );
  });

  it("scopes the three task tables by task_id and audit_logs by entity", async () => {
    await getTaskTimeline("task-1");
    expect(recorded.eqs).toContainEqual(["task_id", "task-1"]);
    expect(recorded.eqs).toContainEqual(["entity_type", "task"]);
    expect(recorded.eqs).toContainEqual(["entity_id", "task-1"]);
  });
});
