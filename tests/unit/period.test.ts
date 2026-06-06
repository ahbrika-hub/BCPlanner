import { describe, it, expect } from "vitest";

import { currentPeriod, recentPeriods } from "@/lib/performance/period";

describe("period helpers", () => {
  it("derives the quarter label", () => {
    expect(currentPeriod(new Date(Date.UTC(2026, 4, 15)))).toBe("2026-Q2"); // May
    expect(currentPeriod(new Date(Date.UTC(2026, 0, 1)))).toBe("2026-Q1");
    expect(currentPeriod(new Date(Date.UTC(2026, 11, 31)))).toBe("2026-Q4");
  });

  it("lists recent periods newest-first with year wraparound", () => {
    const out = recentPeriods(3, new Date(Date.UTC(2026, 1, 1))); // Q1
    expect(out).toEqual(["2026-Q1", "2025-Q4", "2025-Q3"]);
  });
});
