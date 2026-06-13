import { describe, it, expect, beforeEach, vi } from "vitest";

const session = vi.hoisted(() => ({
  getCurrentProfile: vi.fn(),
  getCurrentPermissions: vi.fn(),
}));
const rpc = vi.hoisted(() => ({ fn: vi.fn() }));

vi.mock("@/lib/auth/session", () => session);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ rpc: rpc.fn })),
}));

import { requestDashboardUpdateAction } from "@/lib/actions/dashboard-request";

beforeEach(() => {
  vi.clearAllMocks();
  session.getCurrentProfile.mockResolvedValue({ id: "u1", role: "ceo" });
  session.getCurrentPermissions.mockResolvedValue(["dashboard.request_update"]);
});

describe("requestDashboardUpdateAction", () => {
  it("creates the request for a dashboard.request_update holder (incl. ceo)", async () => {
    rpc.fn.mockResolvedValue({ data: { created: true, taskId: "t9" }, error: null });
    const res = await requestDashboardUpdateAction();
    expect(res).toEqual({ ok: true, id: "t9" });
    expect(rpc.fn).toHaveBeenCalledWith("request_dashboard_update", {});
  });

  it("forwards a chosen assignee", async () => {
    rpc.fn.mockResolvedValue({ data: { created: true, taskId: "t9" }, error: null });
    await requestDashboardUpdateAction("assignee-7");
    expect(rpc.fn).toHaveBeenCalledWith("request_dashboard_update", {
      p_assignee: "assignee-7",
    });
  });

  it("reports the de-dup no-op", async () => {
    rpc.fn.mockResolvedValue({ data: { created: false, reason: "in_progress" }, error: null });
    const res = await requestDashboardUpdateAction();
    expect(res).toEqual({
      ok: false,
      error: "A dashboard update is already in progress.",
    });
  });

  it("returns the no_assignee sentinel so the UI can prompt", async () => {
    rpc.fn.mockResolvedValue({ data: { created: false, reason: "no_assignee" }, error: null });
    const res = await requestDashboardUpdateAction();
    expect(res).toEqual({ ok: false, error: "no_assignee" });
  });

  it("refuses a caller without dashboard.request_update (no RPC)", async () => {
    session.getCurrentPermissions.mockResolvedValue(["dashboard.read"]);
    const res = await requestDashboardUpdateAction();
    expect(res).toEqual({ ok: false, error: "Not authorized." });
    expect(rpc.fn).not.toHaveBeenCalled();
  });
});
