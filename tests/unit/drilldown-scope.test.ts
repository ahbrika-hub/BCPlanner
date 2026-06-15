import { describe, it, expect } from "vitest";

import { getDrilldownScope } from "@/lib/dashboard/drilldown-scope";

describe("getDrilldownScope", () => {
  it("employee → own (their own/assigned tasks only)", () => {
    expect(getDrilldownScope("employee")).toBe("own");
  });
  it("section_head and admin → all", () => {
    expect(getDrilldownScope("section_head")).toBe("all");
    expect(getDrilldownScope("admin")).toBe("all");
  });
  it("ceo → none (read-only executive overview)", () => {
    expect(getDrilldownScope("ceo")).toBe("none");
  });
});
