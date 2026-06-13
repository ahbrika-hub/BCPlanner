import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";

import { dashboardDataSchema } from "@/lib/validations/dashboard";

// The full TSS design DATA (from the migration HTML) seeded as the sample
// snapshot MUST validate against the tolerant schema (PR-D1), so the live demo
// renders every KPI/chart/table without falling back to the empty state.
const fixture = fileURLToPath(
  new URL("../fixtures/weekly-design-sample.json", import.meta.url),
);

describe("weekly design sample data", () => {
  it("validates against dashboardDataSchema", () => {
    const data = JSON.parse(readFileSync(fixture, "utf8"));
    const res = dashboardDataSchema.safeParse(data);
    if (!res.success) console.error(res.error.issues.slice(0, 5));
    expect(res.success).toBe(true);
  });

  it("includes all four business lines with their full KPI sets", () => {
    const data = JSON.parse(readFileSync(fixture, "utf8"));
    const ids = data.businessLines.map((b: { id: string }) => b.id);
    expect(ids).toEqual(["tss", "merapp", "artc", "driving-school"]);
  });
});
