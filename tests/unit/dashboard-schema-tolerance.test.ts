import { describe, it, expect } from "vitest";

import { dashboardDataSchema } from "@/lib/validations/dashboard";

// PR-D1 guardrail: existing snapshots (string delta, no line/tagline/tag/lead,
// classic charts/tables) MUST still validate, AND the new §7 deltas (line chart,
// {dir,text} delta, tagline, lead bool, tag, chart span/subtitle, column
// align/strong, table meta, an extra "tss" business line) must validate too.

const meta = {
  title: "TSS Weekly",
  subtitle: "Week 24",
  lastRefreshed: "2026-06-13 09:00",
  weekStart: "2026-06-08",
  periods: [
    { id: "week", label: "Week" },
    { id: "mtd", label: "MTD" },
    { id: "ytd", label: "YTD" },
  ],
  defaultBl: "merapp",
  defaultPeriod: "week",
  footLeft: "Source: weekly upload",
  footRight: "TSS",
};

// A faithful "existing" business line: legacy string delta, classic charts,
// rich table cells — none of the §7 deltas.
const legacyBl = {
  id: "merapp",
  name: "merapp",
  accent: "#EE8742",
  isSample: false,
  kpiGroups: [
    {
      num: 1,
      title: "Revenue",
      kpis: [
        {
          id: "rev",
          label: "Revenue",
          values: { week: "SAR 1.2M", mtd: "SAR 4M", ytd: "SAR 40M" },
          delta: "+6%", // legacy STRING delta
          rag: "green",
          note: "vs last week",
        },
      ],
    },
  ],
  charts: [
    {
      id: "c1",
      title: "Revenue by Segment",
      type: "doughnut",
      valueKind: "currency",
      segments: [{ label: "A", value: 10, color: "#762651" }],
    },
    {
      id: "c2",
      title: "Billed vs Backlog",
      type: "groupedBar",
      valueKind: "currency",
      categories: ["Jan", "Feb"],
      series: [{ name: "Billed", color: "#193560", data: [3, 4] }],
    },
  ],
  tables: [
    {
      id: "t1",
      title: "Scorecard",
      columns: [
        { key: "name", label: "Name", kind: "text" },
        { key: "rev", label: "Revenue", kind: "currency" },
        { key: "status", label: "Status", kind: "rag" },
        { key: "util", label: "Utilisation", kind: "minibar" },
      ],
      rows: [
        {
          name: "Unit A",
          rev: 1200,
          status: { label: "On track", level: "green" },
          util: { value: 80, max: 100, color: "#3D8540", display: "80%" },
        },
      ],
    },
  ],
};

describe("dashboardDataSchema — existing snapshots still validate", () => {
  it("accepts a legacy-shape snapshot unchanged", () => {
    const res = dashboardDataSchema.safeParse({
      meta,
      businessLines: [legacyBl],
    });
    expect(res.success).toBe(true);
  });

  it("accepts an empty businessLines array (partial workbook)", () => {
    const res = dashboardDataSchema.safeParse({ meta, businessLines: [] });
    expect(res.success).toBe(true);
  });
});

describe("dashboardDataSchema — tolerates the §7 deltas", () => {
  it("accepts a line chart, {dir,text} delta, tagline, lead, tag, span/subtitle, column align/strong, table meta, and a tss line", () => {
    const tssBl = {
      id: "tss",
      name: "TSS Consolidated",
      accent: "#762651",
      isSample: false,
      tagline: "Portfolio roll-up",
      kpiGroups: [
        {
          num: 1,
          title: "Revenue",
          subtitle: "All lines",
          accent: "#762651",
          cols: 5,
          kpis: [
            {
              id: "rev",
              label: "Revenue",
              values: { week: "SAR 3M", mtd: "SAR 12M", ytd: "SAR 120M" },
              delta: { dir: "up", text: "+8% WoW" }, // NEW object delta
              rag: "green",
              tag: "Group",
              lead: true,
              target: { value: 3, target: 4, suffix: "M" },
            },
          ],
        },
      ],
      charts: [
        {
          id: "trend",
          title: "Weekly Revenue Trend",
          subtitle: "Last 5 weeks",
          span: "wide",
          type: "line", // NEW chart type
          valueKind: "currency",
          categories: ["W20", "W21", "W22", "W23", "W24"],
          series: [{ name: "Total", color: "#762651", data: [1, 2, 3, 4, 5] }],
        },
      ],
      tables: [
        {
          id: "branches",
          title: "Branches",
          meta: "Top 5 by revenue", // NEW table meta
          columns: [
            { key: "branch", label: "Branch", kind: "text", strong: true },
            { key: "rev", label: "Revenue", kind: "currency", align: "right" },
          ],
          rows: [{ branch: "Riyadh", rev: 5000 }],
        },
      ],
    };

    const res = dashboardDataSchema.safeParse({
      meta,
      businessLines: [legacyBl, tssBl],
    });
    expect(res.success).toBe(true);
    if (res.success) {
      const tss = res.data.businessLines.find((b) => b.id === "tss");
      expect(tss?.charts[0]!.type).toBe("line");
    }
  });

  it("still rejects an unknown chart type (discriminated union stays strict)", () => {
    const res = dashboardDataSchema.safeParse({
      meta,
      businessLines: [
        { ...legacyBl, charts: [{ id: "x", title: "X", type: "radar", valueKind: "count", segments: [] }] },
      ],
    });
    expect(res.success).toBe(false);
  });
});
