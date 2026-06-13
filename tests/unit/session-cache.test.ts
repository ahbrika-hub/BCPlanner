import { describe, it, expect, beforeEach, vi } from "vitest";

// Behavior-neutral proof for the cache()-wrapped auth helpers: wrapping must not
// change what they return for a given session. We stub the Supabase client and
// assert the helpers return exactly the user / profile / permission set the
// backend produced — no gating or shape change.
const state = vi.hoisted(() => ({
  user: null as null | { id: string },
  profile: null as null | Record<string, unknown>,
  perms: [] as string[],
}));

function makeClient() {
  return {
    auth: { getUser: async () => ({ data: { user: state.user } }) },
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: state.profile }) }),
      }),
    }),
    rpc: async () => ({ data: state.perms }),
  };
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => makeClient()),
}));

import {
  getCurrentUser,
  getCurrentProfile,
  getCurrentPermissions,
} from "@/lib/auth/session";

beforeEach(() => {
  state.user = { id: "u-ceo" };
  state.profile = { id: "u-ceo", role: "ceo", is_active: true };
  state.perms = ["reports.read_all", "tasks.read_all", "dashboard.executive"];
});

describe("cache()-wrapped auth helpers are behavior-neutral", () => {
  it("getCurrentUser returns the validated user unchanged", async () => {
    expect(await getCurrentUser()).toEqual({ id: "u-ceo" });
  });

  it("getCurrentProfile returns the profile row unchanged", async () => {
    expect(await getCurrentProfile()).toEqual({
      id: "u-ceo",
      role: "ceo",
      is_active: true,
    });
  });

  it("getCurrentPermissions returns the exact permission set (no gating change)", async () => {
    expect(await getCurrentPermissions()).toEqual([
      "reports.read_all",
      "tasks.read_all",
      "dashboard.executive",
    ]);
  });

  it("returns null profile / empty permissions for an anonymous session", async () => {
    state.user = null;
    state.profile = null;
    state.perms = [];
    expect(await getCurrentProfile()).toBeNull();
    expect(await getCurrentPermissions()).toEqual([]);
  });
});
