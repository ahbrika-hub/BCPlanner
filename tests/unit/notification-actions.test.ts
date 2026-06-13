import { describe, it, expect, beforeEach, vi } from "vitest";

// Proves the notification mutation data layer is owner-scoped: every bulk
// mark/delete is filtered by `user_id = <caller>` in addition to the RLS
// `notifications_update` / `notifications_delete` policies. The server actions
// derive that user id from the authenticated session (bulk() -> profile.id),
// so a caller cannot target another user's rows.
const recorded = vi.hoisted(() => ({ calls: [] as Array<[string, ...unknown[]]> }));

function makeBuilder() {
  const b: Record<string, unknown> = {};
  b.update = vi.fn(() => b);
  b.delete = vi.fn(() => b);
  b.eq = vi.fn((col: string, val: unknown) => {
    recorded.calls.push(["eq", col, val]);
    return b;
  });
  b.in = vi.fn((col: string, val: unknown) => {
    recorded.calls.push(["in", col, val]);
    return Promise.resolve({ error: null });
  });
  return b;
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ from: vi.fn(() => makeBuilder()) })),
}));

import { markByIds, deleteByIds } from "@/lib/data/notifications";

beforeEach(() => {
  recorded.calls = [];
});

describe("notification mutations are owner-scoped", () => {
  it("markByIds filters by the caller's user_id and the id list", async () => {
    await markByIds("owner-1", ["n1", "n2"], true);
    expect(recorded.calls).toContainEqual(["eq", "user_id", "owner-1"]);
    expect(recorded.calls).toContainEqual(["in", "id", ["n1", "n2"]]);
  });

  it("deleteByIds filters by the caller's user_id and the id list", async () => {
    await deleteByIds("owner-1", ["n1"]);
    expect(recorded.calls).toContainEqual(["eq", "user_id", "owner-1"]);
    expect(recorded.calls).toContainEqual(["in", "id", ["n1"]]);
  });

  it("is a no-op for an empty id list (no query issued)", async () => {
    await markByIds("owner-1", [], true);
    await deleteByIds("owner-1", []);
    expect(recorded.calls).toHaveLength(0);
  });
});
