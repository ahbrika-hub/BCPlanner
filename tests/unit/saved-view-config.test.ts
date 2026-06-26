import { describe, it, expect } from "vitest";

import {
  savedViewConfigSchema,
  configToQueryString,
  searchParamsToConfig,
} from "@/lib/tasks/saved-view-config";

// Valid v4 UUIDs (matching what Postgres gen_random_uuid() produces).
const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-9222-222222222222";

describe("savedViewConfigSchema", () => {
  it("accepts a representative valid config", () => {
    const config = {
      q: "report",
      status: ["in_progress", "completed"],
      priority: "high",
      overdue: true,
      assignee: A,
      business_line: B,
      sort: "due_date.asc",
    };
    const res = savedViewConfigSchema.safeParse(config);
    expect(res.success).toBe(true);
  });

  it("accepts an empty config", () => {
    expect(savedViewConfigSchema.safeParse({}).success).toBe(true);
  });

  it("rejects an unknown key", () => {
    const res = savedViewConfigSchema.safeParse({ view: "abc", q: "x" });
    expect(res.success).toBe(false);
  });

  it("rejects a malformed sort value", () => {
    expect(
      savedViewConfigSchema.safeParse({ sort: "due_date.sideways" }).success,
    ).toBe(false);
    expect(
      savedViewConfigSchema.safeParse({ sort: "bogus.asc" }).success,
    ).toBe(false);
  });

  it("rejects a non-uuid assignee and an invalid status", () => {
    expect(
      savedViewConfigSchema.safeParse({ assignee: "not-a-uuid" }).success,
    ).toBe(false);
    expect(
      savedViewConfigSchema.safeParse({ status: ["nope"] }).success,
    ).toBe(false);
  });

  it("rejects an invalid priority", () => {
    expect(
      savedViewConfigSchema.safeParse({ priority: "urgent" }).success,
    ).toBe(false);
  });
});

describe("config <-> query string round-trip", () => {
  it("serializes a config to the existing URL param formats", () => {
    const qs = configToQueryString({
      q: "report",
      status: ["in_progress", "completed"],
      priority: "high",
      overdue: true,
      assignee: A,
      business_line: B,
      sort: "due_date.asc",
    });
    const params = new URLSearchParams(qs);
    expect(params.get("q")).toBe("report");
    expect(params.get("status")).toBe("in_progress,completed");
    expect(params.get("priority")).toBe("high");
    expect(params.get("overdue")).toBe("1");
    expect(params.get("assignee")).toBe(A);
    expect(params.get("business_line")).toBe(B);
    expect(params.get("sort")).toBe("due_date.asc");
  });

  it("round-trips through searchParamsToConfig unchanged", () => {
    const config = {
      q: "report",
      status: ["in_progress", "completed"],
      priority: "high" as const,
      overdue: true,
      assignee: A,
      business_line: B,
      sort: "due_date.asc",
    };
    const back = searchParamsToConfig(
      new URLSearchParams(configToQueryString(config)),
    );
    expect(back).toEqual(config);
  });

  it("ignores unknown params (e.g. `view`) and `all` sentinels on read", () => {
    const back = searchParamsToConfig(
      new URLSearchParams(
        "q=hi&view=xyz&priority=all&assignee=all&status=draft,bogus",
      ),
    );
    expect(back).toEqual({ q: "hi", status: ["draft"] });
  });

  it("empty / invalid config serializes to an empty query string", () => {
    expect(configToQueryString({})).toBe("");
    expect(configToQueryString({ bogus: 1 })).toBe("");
  });
});
