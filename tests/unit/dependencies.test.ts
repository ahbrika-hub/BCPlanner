import { describe, it, expect, beforeEach, vi } from "vitest";

// Dependency creation reuses RLS + the DB cycle guard; the action adds a friendly
// permission gate and maps raw DB errors (cycle/self/duplicate/RLS) to messages.
const session = vi.hoisted(() => ({
  getCurrentProfile: vi.fn(),
  getCurrentPermissions: vi.fn(),
}));
const depsData = vi.hoisted(() => ({
  addDependency: vi.fn(),
  removeDependency: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => session);
vi.mock("@/lib/data/dependencies", () => depsData);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { addDependencyAction } from "@/lib/actions/dependencies";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

beforeEach(() => {
  vi.clearAllMocks();
  session.getCurrentProfile.mockResolvedValue({ id: "u1", role: "section_head" });
  session.getCurrentPermissions.mockResolvedValue(["tasks.update"]);
  depsData.addDependency.mockResolvedValue({ id: "d1" });
});

describe("addDependencyAction", () => {
  it("adds a dependency when permitted", async () => {
    const res = await addDependencyAction(A, B);
    expect(res.ok).toBe(true);
    expect(depsData.addDependency).toHaveBeenCalledWith({
      task_id: A,
      depends_on_task_id: B,
      created_by: "u1",
    });
  });

  it("rejects a self-dependency before touching the DB", async () => {
    const res = await addDependencyAction(A, A);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/itself/i);
    expect(depsData.addDependency).not.toHaveBeenCalled();
  });

  it("is denied without tasks.update", async () => {
    session.getCurrentPermissions.mockResolvedValue(["tasks.read"]);
    const res = await addDependencyAction(A, B);
    expect(res).toMatchObject({ ok: false });
    expect(depsData.addDependency).not.toHaveBeenCalled();
  });

  it("maps a DB cycle error to a friendly message", async () => {
    depsData.addDependency.mockRejectedValue(
      new Error("Adding this dependency would create a cycle"),
    );
    const res = await addDependencyAction(A, B);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/cycle/i);
  });

  it("maps a unique-violation to 'already exists'", async () => {
    depsData.addDependency.mockRejectedValue(
      new Error('duplicate key value violates unique constraint "..."'),
    );
    const res = await addDependencyAction(A, B);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/already exists/i);
  });
});
