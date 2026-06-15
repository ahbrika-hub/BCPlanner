import { describe, it, expect } from "vitest";

import {
  calendarDays,
  capacityHours,
  taskOverlapsRange,
  aggregateEmployeeWorkload,
  resolveWorkloadRange,
  WORK_HOURS_PER_DAY,
  type WorkloadTaskInput,
} from "@/lib/workload/compute";

describe("calendarDays / capacityHours", () => {
  it("counts inclusive days (single day = 1)", () => {
    expect(calendarDays("2026-06-15", "2026-06-15")).toBe(1);
    expect(calendarDays("2026-06-15", "2026-06-21")).toBe(7);
    expect(calendarDays("2026-06-01", "2026-06-30")).toBe(30);
  });
  it("returns 0 for an inverted/invalid range", () => {
    expect(calendarDays("2026-06-21", "2026-06-15")).toBe(0);
    expect(calendarDays("nope", "2026-06-15")).toBe(0);
  });
  it("capacity = 8h × inclusive days", () => {
    expect(capacityHours("2026-06-15", "2026-06-15")).toBe(WORK_HOURS_PER_DAY);
    expect(capacityHours("2026-06-15", "2026-06-21")).toBe(7 * 8);
  });
});

describe("taskOverlapsRange", () => {
  const F = "2026-06-08";
  const T = "2026-06-14";
  it("multi-day window overlapping the range", () => {
    expect(taskOverlapsRange("2026-06-10", "2026-06-12", F, T)).toBe(true); // inside
    expect(taskOverlapsRange("2026-06-01", "2026-06-09", F, T)).toBe(true); // straddles start
    expect(taskOverlapsRange("2026-06-13", "2026-06-20", F, T)).toBe(true); // straddles end
  });
  it("single-day window on a boundary", () => {
    expect(taskOverlapsRange("2026-06-14", "2026-06-14", F, T)).toBe(true); // on `to`
    expect(taskOverlapsRange("2026-06-08", "2026-06-08", F, T)).toBe(true); // on `from`
  });
  it("excludes windows entirely before or after the range", () => {
    expect(taskOverlapsRange("2026-06-01", "2026-06-07", F, T)).toBe(false); // ends before
    expect(taskOverlapsRange("2026-06-15", "2026-06-20", F, T)).toBe(false); // starts after
  });
  it("treats a null due date as open-ended (still active)", () => {
    expect(taskOverlapsRange("2026-06-01", null, F, T)).toBe(true);
    expect(taskOverlapsRange("2026-06-20", null, F, T)).toBe(false); // starts after `to`
  });
});

describe("aggregateEmployeeWorkload", () => {
  const F = "2026-06-08";
  const T = "2026-06-14"; // 7 days → 56h capacity
  const mk = (
    hours: number | null,
    start: string | null,
    due: string | null,
    created = "2026-06-09T00:00:00Z",
  ): WorkloadTaskInput => ({
    estimated_effort_hours: hours,
    start_date: start,
    due_date: due,
    created_at: created,
  });

  it("sums only overlapping tasks' hours and derives utilization & level", () => {
    const tasks = [
      mk(10, "2026-06-10", "2026-06-12"), // in
      mk(4, "2026-06-01", "2026-06-09"), // straddles start, in
      mk(100, "2026-06-20", "2026-06-25"), // out (after)
      mk(null, "2026-06-09", null), // open-ended, in, 0h
    ];
    const agg = aggregateEmployeeWorkload(tasks, F, T);
    expect(agg.active_task_count).toBe(3);
    expect(agg.total_estimated_hours).toBe(14);
    expect(agg.capacity_hours).toBe(56);
    expect(agg.utilization_pct).toBe(25); // 14/56*100
    expect(agg.workload_level).toBe("medium"); // count 3 > 2
  });

  it("empty range → no capacity, zero utilization", () => {
    const agg = aggregateEmployeeWorkload([mk(8, "2026-06-21", "2026-06-21")], "2026-06-21", "2026-06-15");
    expect(agg.capacity_hours).toBe(0);
    expect(agg.utilization_pct).toBe(0);
  });

  it("levels: >5 high, >2 medium, else low (single-day range)", () => {
    const day = (n: number) =>
      Array.from({ length: n }, () => mk(1, "2026-06-15", "2026-06-15"));
    expect(aggregateEmployeeWorkload(day(6), "2026-06-15", "2026-06-15").workload_level).toBe("high");
    expect(aggregateEmployeeWorkload(day(3), "2026-06-15", "2026-06-15").workload_level).toBe("medium");
    expect(aggregateEmployeeWorkload(day(1), "2026-06-15", "2026-06-15").workload_level).toBe("low");
  });
});

describe("resolveWorkloadRange", () => {
  const anchor = "2026-06-15"; // a Monday
  it("today = single day", () => {
    expect(resolveWorkloadRange("today", anchor)).toEqual({
      from: anchor,
      to: anchor,
      preset: "today",
    });
  });
  it("week = Sun→Sat containing the anchor", () => {
    // 2026-06-15 is Monday → week Sun 2026-06-14 .. Sat 2026-06-20
    expect(resolveWorkloadRange("week", anchor)).toEqual({
      from: "2026-06-14",
      to: "2026-06-20",
      preset: "week",
    });
  });
  it("month = 1st→last day", () => {
    expect(resolveWorkloadRange("month", anchor)).toEqual({
      from: "2026-06-01",
      to: "2026-06-30",
      preset: "month",
    });
  });
  it("custom uses provided bounds and normalises inversion", () => {
    expect(resolveWorkloadRange("custom", anchor, "2026-06-10", "2026-06-12")).toEqual({
      from: "2026-06-10",
      to: "2026-06-12",
      preset: "custom",
    });
    expect(resolveWorkloadRange("custom", anchor, "2026-06-12", "2026-06-10")).toEqual({
      from: "2026-06-10",
      to: "2026-06-12",
      preset: "custom",
    });
  });
  it("custom falls back to the anchor when bounds are missing", () => {
    expect(resolveWorkloadRange("custom", anchor)).toEqual({
      from: anchor,
      to: anchor,
      preset: "custom",
    });
  });
});
