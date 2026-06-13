import { describe, it, expect } from "vitest";

import { LOGO_SOURCES } from "@/components/brand/tss-logo";

// The intermittent login-logo disappearance was caused by leading the source
// list with `/brand/tss-logo.svg`, which is NOT committed — the first paint was
// a guaranteed 404 whose onError could race hydration. Leading with the
// committed PNG makes the first paint deterministic. This locks that in.
describe("logo source resolution", () => {
  it("leads with the committed PNG asset", () => {
    expect(LOGO_SOURCES[0]).toBe("/brand/tss-logo.png");
  });

  it("does not lead with the missing .svg (the root cause)", () => {
    expect(LOGO_SOURCES).not.toContain("/brand/tss-logo.svg");
    expect(LOGO_SOURCES.length).toBeGreaterThan(0);
  });
});
