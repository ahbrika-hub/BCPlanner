import { describe, it, expect } from "vitest";

import { calculatePerformanceScore } from "@/lib/performance/score";

describe("calculatePerformanceScore (40/30/30)", () => {
  it("matches the worked example (10/8/2/4.0 = 80)", () => {
    expect(
      calculatePerformanceScore({
        assigned_count: 10,
        completed_count: 8,
        delayed_count: 2,
        quality_avg_rating: 4.0,
      }),
    ).toBe(80);
  });

  it("returns 0 when there are no assigned tasks (no divide-by-zero)", () => {
    expect(
      calculatePerformanceScore({
        assigned_count: 0,
        completed_count: 0,
        delayed_count: 0,
        quality_avg_rating: null,
      }),
    ).toBe(0);
  });

  it("returns 100 for a perfect period", () => {
    expect(
      calculatePerformanceScore({
        assigned_count: 4,
        completed_count: 4,
        delayed_count: 0,
        quality_avg_rating: 5,
      }),
    ).toBe(100);
  });

  it("treats null quality as 0 contribution", () => {
    // completion 100% (40) + quality 0 + timeliness 100% (30) = 70
    expect(
      calculatePerformanceScore({
        assigned_count: 2,
        completed_count: 2,
        delayed_count: 0,
        quality_avg_rating: null,
      }),
    ).toBe(70);
  });
});
