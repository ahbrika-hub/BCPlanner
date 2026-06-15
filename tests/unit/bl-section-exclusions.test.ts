import { describe, it, expect } from "vitest";

import {
  applyBlSectionExclusions,
  BL_SECTION_EXCLUSIONS,
} from "@/lib/dashboard/bl-section-exclusions";
import type { DashboardData } from "@/lib/validations/dashboard";

// Minimal chart/table/line stubs — the transform only reads id/title and filters
// arrays, so we cast a structurally-minimal fixture to the strict type.
const chart = (id: string, title: string) => ({ id, title, type: "doughnut" });
const table = (id: string, title: string) => ({ id, title, columns: [], rows: [] });
const line = (
  id: string,
  charts: ReturnType<typeof chart>[],
  tables: ReturnType<typeof table>[],
) => ({ id, name: id, accent: "#000", isSample: false, kpiGroups: [], charts, tables });

function fixture() {
  return {
    meta: {},
    businessLines: [
      // control line — must come back byte-identical
      line("tss", [chart("t-c", "Some Chart")], [table("t-t", "Some Table")]),
      // merapp — only "Technician KPIs" table removed; chart + other table kept
      line(
        "merapp",
        [chart("m-segment", "Revenue by Segment")],
        [table("m-techs", "Technician KPIs"), table("m-branches", "Branch Performance")],
      ),
      // artc — entire Analysis Charts section (all charts) removed; tables kept
      line("artc", [chart("a-billing", "PO Value · Billed vs Unbilled")], [table("a-t", "Keep me")]),
    ],
  } as unknown as DashboardData;
}

describe("applyBlSectionExclusions", () => {
  it("removes ONLY merapp's Technician KPIs table and ALL of artc's charts", () => {
    const input = fixture();
    const out = applyBlSectionExclusions(input);

    const merapp = out.businessLines.find((b) => b.id === "merapp")!;
    expect(merapp.tables.map((t) => t.title)).toEqual(["Branch Performance"]);
    // merapp charts untouched (same reference — no chart config for merapp)
    expect(merapp.charts).toBe(
      input.businessLines.find((b) => b.id === "merapp")!.charts,
    );

    const artc = out.businessLines.find((b) => b.id === "artc")!;
    expect(artc.charts).toEqual([]); // whole "Analysis Charts" section gone
    // artc tables untouched
    expect(artc.tables.map((t) => t.title)).toEqual(["Keep me"]);
  });

  it("leaves a control line (and all unmatched entries) byte-identical by reference", () => {
    const input = fixture();
    const out = applyBlSectionExclusions(input);

    const tssIn = input.businessLines.find((b) => b.id === "tss")!;
    const tssOut = out.businessLines.find((b) => b.id === "tss")!;
    expect(tssOut).toBe(tssIn); // same object reference — untouched

    // merapp's kept table is the same element reference (filter preserves it)
    const branchIn = input.businessLines
      .find((b) => b.id === "merapp")!
      .tables.find((t) => t.id === "m-branches");
    const branchOut = out.businessLines
      .find((b) => b.id === "merapp")!
      .tables.find((t) => t.id === "m-branches");
    expect(branchOut).toBe(branchIn);
  });

  it("is a no-op (same reference) for data with no configured lines", () => {
    const data = {
      meta: {},
      businessLines: [line("driving-school", [chart("d", "x")], [table("d2", "y")])],
    } as unknown as DashboardData;
    expect(applyBlSectionExclusions(data)).toBe(data);
  });

  it("config is slug-keyed for exactly merapp + artc", () => {
    expect(Object.keys(BL_SECTION_EXCLUSIONS).sort()).toEqual(["artc", "merapp"]);
  });
});
