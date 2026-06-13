import { describe, it, expect, beforeEach, vi } from "vitest";

// PR-D2: getLatestSnapshot reads via the SECURITY DEFINER live-resolver
// (get_latest_live_snapshot), NOT the RLS-scoped table select — so the
// completed-check isn't filtered by the viewer's task RLS.
const rpc = vi.hoisted(() => ({ fn: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ rpc: rpc.fn })),
}));

import { getLatestSnapshot } from "@/lib/data/dashboard";

const VALID_DATA = {
  meta: {
    title: "TSS Weekly",
    subtitle: "Week 24",
    lastRefreshed: "2026-06-13",
    weekStart: "2026-06-08",
    periods: [{ id: "week", label: "Week" }],
    defaultBl: "merapp",
    defaultPeriod: "week",
    footLeft: "",
    footRight: "",
  },
  businessLines: [],
};

beforeEach(() => rpc.fn.mockReset());

describe("getLatestSnapshot (live-on-acceptance)", () => {
  it("calls the live-resolver RPC and returns the validated snapshot", async () => {
    rpc.fn.mockResolvedValue({
      data: [
        { week_start: "2026-06-08", created_at: "2026-06-08T09:00:00Z", data: VALID_DATA },
      ],
      error: null,
    });
    const snap = await getLatestSnapshot();
    expect(rpc.fn).toHaveBeenCalledWith("get_latest_live_snapshot");
    expect(snap).toEqual({
      weekStart: "2026-06-08",
      createdAt: "2026-06-08T09:00:00Z",
      data: VALID_DATA,
    });
  });

  it("returns null when no live snapshot exists (empty result)", async () => {
    rpc.fn.mockResolvedValue({ data: [], error: null });
    expect(await getLatestSnapshot()).toBeNull();
  });

  it("returns null when the stored payload fails validation", async () => {
    rpc.fn.mockResolvedValue({
      data: [{ week_start: "2026-06-08", created_at: "x", data: { bogus: true } }],
      error: null,
    });
    expect(await getLatestSnapshot()).toBeNull();
  });
});
