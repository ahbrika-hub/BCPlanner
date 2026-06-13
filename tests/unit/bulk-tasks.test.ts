import { describe, it, expect, beforeEach, vi } from "vitest";

// THE INVARIANT under test: bulkTransitionTasks processes each selected task by
// calling the EXISTING single-task transitionTaskAction — never a blanket
// multi-row UPDATE and never a DB/service-role client. We therefore mock ONLY
// transitionTaskAction; the supabase server client is intentionally NOT mocked,
// so if the batch tried to touch the DB directly this suite would fail to run.
const single = vi.hoisted(() => ({ transitionTaskAction: vi.fn() }));
vi.mock("@/lib/actions/tasks", () => ({
  transitionTaskAction: single.transitionTaskAction,
}));

import { bulkTransitionTasks } from "@/lib/actions/bulk-tasks";
import { BULK_SELECTION_CAP } from "@/lib/tasks/transitions";

beforeEach(() => {
  single.transitionTaskAction.mockReset();
});

describe("bulkTransitionTasks routes every task through the single-task action", () => {
  it("MIXED success/failure: valid tasks transition, invalid fail per-row, none forced", async () => {
    // t2 is in the wrong state (DB guard message); t3 the actor may not act on.
    single.transitionTaskAction.mockImplementation(async (id: string) => {
      if (id === "t2")
        return {
          ok: false,
          error: "Illegal task status transition: assigned -> approved",
        };
      if (id === "t3") return { ok: false, error: "Not authorized." };
      return { ok: true, id };
    });

    const res = await bulkTransitionTasks(["t1", "t2", "t3"], "approve", {});

    expect(res.succeeded).toBe(1);
    expect(res.failed).toBe(2);
    expect(res.results).toEqual([
      { taskId: "t1", ok: true },
      {
        taskId: "t2",
        ok: false,
        reason: "Illegal task status transition: assigned -> approved",
      },
      { taskId: "t3", ok: false, reason: "Not authorized." },
    ]);
    // Each task went through the reused single-task action exactly once.
    expect(single.transitionTaskAction).toHaveBeenCalledTimes(3);
    expect(single.transitionTaskAction).toHaveBeenNthCalledWith(1, "t1", "approve", {});
    expect(single.transitionTaskAction).toHaveBeenNthCalledWith(2, "t2", "approve", {});
    expect(single.transitionTaskAction).toHaveBeenNthCalledWith(3, "t3", "approve", {});
  });

  it("is INDEPENDENT: one task throwing does not abort or roll back the others", async () => {
    single.transitionTaskAction.mockImplementation(async (id: string) => {
      if (id === "boom") throw new Error("kaboom");
      return { ok: true, id };
    });

    const res = await bulkTransitionTasks(["a", "boom", "c"], "cancel", {});

    expect(res.succeeded).toBe(2);
    expect(res.results.find((r) => r.taskId === "boom")).toEqual({
      taskId: "boom",
      ok: false,
      reason: "kaboom",
    });
    expect(single.transitionTaskAction).toHaveBeenCalledTimes(3); // not aborted
  });

  it("passes the shared payload through to each single-task call", async () => {
    single.transitionTaskAction.mockResolvedValue({ ok: true });
    await bulkTransitionTasks(["t1", "t2"], "reject", { reason: "duplicate" });
    expect(single.transitionTaskAction).toHaveBeenCalledWith("t1", "reject", {
      reason: "duplicate",
    });
    expect(single.transitionTaskAction).toHaveBeenCalledWith("t2", "reject", {
      reason: "duplicate",
    });
  });

  it("de-duplicates selected ids", async () => {
    single.transitionTaskAction.mockResolvedValue({ ok: true });
    const res = await bulkTransitionTasks(["dup", "dup"], "approve", {});
    expect(single.transitionTaskAction).toHaveBeenCalledTimes(1);
    expect(res.results).toHaveLength(1);
  });
});

describe("bulkTransitionTasks refuses unsafe batches without touching tasks", () => {
  it("refuses an empty selection", async () => {
    const res = await bulkTransitionTasks([], "approve", {});
    expect(res.refused).toBe("Nothing selected.");
    expect(single.transitionTaskAction).not.toHaveBeenCalled();
  });

  it("refuses a non-bulk / non-transition action", async () => {
    // log_progress is a valid action but deliberately not a bulk action.
    const res = await bulkTransitionTasks(["t1"], "log_progress", {});
    expect(res.refused).toBe("Unsupported bulk action.");
    expect(single.transitionTaskAction).not.toHaveBeenCalled();
  });

  it("refuses a selection over the cap", async () => {
    const many = Array.from(
      { length: BULK_SELECTION_CAP + 1 },
      (_, i) => `t${i}`,
    );
    const res = await bulkTransitionTasks(many, "approve", {});
    expect(res.refused).toMatch(/at most/);
    expect(single.transitionTaskAction).not.toHaveBeenCalled();
  });
});
