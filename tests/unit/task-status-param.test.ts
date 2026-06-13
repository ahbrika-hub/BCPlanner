import { describe, it, expect } from "vitest";

import { parseStatusParam, asTaskStatus } from "@/lib/tasks/status";

describe("parseStatusParam", () => {
  it("parses a comma-separated single param", () => {
    expect(parseStatusParam("in_progress,completed")).toEqual([
      "in_progress",
      "completed",
    ]);
  });

  it("parses repeated params (string[])", () => {
    expect(parseStatusParam(["assigned", "draft"])).toEqual([
      "assigned",
      "draft",
    ]);
  });

  it("drops invalid tokens and de-duplicates", () => {
    expect(parseStatusParam("assigned,bogus,assigned, ,completed")).toEqual([
      "assigned",
      "completed",
    ]);
  });

  it("returns an empty array for undefined / empty", () => {
    expect(parseStatusParam(undefined)).toEqual([]);
    expect(parseStatusParam("")).toEqual([]);
  });
});

describe("asTaskStatus", () => {
  it("accepts valid enum values and rejects others", () => {
    expect(asTaskStatus("returned_for_modification")).toBe(
      "returned_for_modification",
    );
    expect(asTaskStatus("nope")).toBeUndefined();
  });
});
