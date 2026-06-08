import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";

import { parseWeeklyWorkbook } from "@/lib/dashboard/parse-workbook";
import { dashboardDataSchema } from "@/lib/validations/dashboard";

async function buildSampleWorkbook(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();

  const meta = wb.addWorksheet("Meta");
  meta.addRow(["Field", "Value"]);
  for (const [f, v] of [
    ["week_start", "2026-06-01"],
    ["title", "TSS Weekly Dashboard"],
    ["subtitle", "Week of 1 Jun 2026"],
    ["last_refreshed", "2026-06-01 09:00"],
    ["foot_left", "Confidential"],
    ["foot_right", "Generated weekly"],
    ["default_bl", "tss"],
    ["default_period", "week"],
  ])
    meta.addRow([f, v]);

  const bls = wb.addWorksheet("BusinessLines");
  bls.addRow(["id", "name", "accent", "is_sample", "order"]);
  bls.addRow(["tss", "TSS", "#762651", "N", 1]);

  const kpis = wb.addWorksheet("KPIs");
  kpis.addRow([
    "business_line_id",
    "group_num",
    "group_title",
    "group_subtitle",
    "group_accent",
    "group_cols",
    "kpi_id",
    "kpi_label",
    "value_week",
    "value_mtd",
    "value_ytd",
    "delta",
    "rag",
    "target_value",
    "target_target",
    "target_suffix",
    "note",
    "tag",
    "lead",
  ]);
  // group_num 2 row added BEFORE group_num 1 → output must reorder by num.
  kpis.addRow([
    "tss",
    2,
    "Operations",
    "",
    "",
    2,
    "tickets",
    "Tickets",
    "12",
    "48",
    "520",
    "-3",
    "amber",
    "",
    "",
    "",
    "",
    "",
    "",
  ]);
  kpis.addRow([
    "tss",
    1,
    "Revenue",
    "This week",
    "#762651",
    2,
    "rev",
    "Revenue",
    "SAR 98K",
    "SAR 410K",
    "SAR 4.9M",
    "+6%",
    "green",
    "98",
    "100",
    "K",
    "Strong",
    "core",
    "AR",
  ]);
  kpis.addRow([
    "tss",
    1,
    "Revenue",
    "This week",
    "#762651",
    2,
    "margin",
    "Margin",
    "32%",
    "31%",
    "30%",
    "+1pt",
    "green",
    "",
    "",
    "",
    "",
    "",
    "",
  ]);

  const charts = wb.addWorksheet("Charts");
  charts.addRow([
    "business_line_id",
    "chart_id",
    "chart_title",
    "chart_type",
    "value_kind",
    "category",
    "series_name",
    "label",
    "value",
    "color",
  ]);
  charts.addRow([
    "tss",
    "cmp",
    "Actual vs Target",
    "groupedBar",
    "currency",
    "Q1",
    "Actual",
    "",
    100,
    "#762651",
  ]);
  charts.addRow([
    "tss",
    "cmp",
    "Actual vs Target",
    "groupedBar",
    "currency",
    "Q2",
    "Actual",
    "",
    120,
    "#762651",
  ]);
  charts.addRow([
    "tss",
    "cmp",
    "Actual vs Target",
    "groupedBar",
    "currency",
    "Q1",
    "Target",
    "",
    90,
    "#193560",
  ]);
  charts.addRow([
    "tss",
    "cmp",
    "Actual vs Target",
    "groupedBar",
    "currency",
    "Q2",
    "Target",
    "",
    110,
    "#193560",
  ]);
  charts.addRow([
    "tss",
    "mix",
    "Revenue mix",
    "doughnut",
    "currency",
    "",
    "",
    "Advisory",
    60,
    "#762651",
  ]);
  charts.addRow([
    "tss",
    "mix",
    "Revenue mix",
    "doughnut",
    "currency",
    "",
    "",
    "Operations",
    40,
    "#193560",
  ]);

  const tables = wb.addWorksheet("Tables");
  tables.addRow([
    "business_line_id",
    "table_id",
    "table_title",
    "column_order",
    "column_key",
    "column_label",
    "column_kind",
  ]);
  tables.addRow(["tss", "perf", "Performance", 1, "name", "Name", "text"]);
  tables.addRow(["tss", "perf", "Performance", 2, "score", "Score", "num"]);
  tables.addRow(["tss", "perf", "Performance", 3, "status", "Status", "rag"]);
  tables.addRow([
    "tss",
    "perf",
    "Performance",
    4,
    "util",
    "Utilization",
    "minibar",
  ]);

  const tperf = wb.addWorksheet("T_perf");
  tperf.addRow(["name", "score", "status", "util"]);
  tperf.addRow(["Amal", 4.6, "green|On track", "80|100|#762651|80%"]);

  return Buffer.from(await wb.xlsx.writeBuffer());
}

describe("weekly dashboard workbook parser", () => {
  it("parses a template-conformant workbook into valid DASHBOARD_DATA", async () => {
    const buffer = await buildSampleWorkbook();
    const data = await parseWeeklyWorkbook(buffer);

    // Passes the Zod contract.
    const result = dashboardDataSchema.safeParse(data);
    expect(result.success).toBe(true);

    expect(data.meta.weekStart).toBe("2026-06-01");
    expect(data.meta.defaultBl).toBe("tss");

    const bl = data.businessLines[0]!;
    expect(bl.id).toBe("tss");
    expect(bl.isSample).toBe(false);

    // KPIs grouped + reordered by group_num (Revenue=1 before Operations=2).
    expect(bl.kpiGroups.map((g) => g.title)).toEqual(["Revenue", "Operations"]);
    const g0 = bl.kpiGroups[0]!;
    const k0 = g0.kpis[0]!;
    expect(g0.kpis.map((k) => k.id)).toEqual(["rev", "margin"]);
    expect(k0.values).toEqual({
      week: "SAR 98K",
      mtd: "SAR 410K",
      ytd: "SAR 4.9M",
    });
    expect(k0.target).toEqual({
      value: 98,
      target: 100,
      suffix: "K",
    });

    // groupedBar pivot: categories × series → series[].data.
    const grouped = bl.charts.find((c) => c.id === "cmp");
    expect(grouped?.type).toBe("groupedBar");
    if (grouped?.type === "groupedBar") {
      expect(grouped.categories).toEqual(["Q1", "Q2"]);
      expect(grouped.series).toEqual([
        { name: "Actual", color: "#762651", data: [100, 120] },
        { name: "Target", color: "#193560", data: [90, 110] },
      ]);
    }

    // doughnut segments.
    const doughnut = bl.charts.find((c) => c.id === "mix");
    expect(doughnut?.type).toBe("doughnut");
    if (doughnut?.type === "doughnut") {
      expect(doughnut.segments).toEqual([
        { label: "Advisory", value: 60, color: "#762651" },
        { label: "Operations", value: 40, color: "#193560" },
      ]);
    }

    // Table decoded by column kind.
    const table = bl.tables[0]!;
    expect(table.id).toBe("perf");
    expect(table.columns.map((c) => c.kind)).toEqual([
      "text",
      "num",
      "rag",
      "minibar",
    ]);
    expect(table.rows[0]!).toEqual({
      name: "Amal",
      score: 4.6,
      status: { label: "On track", level: "green" },
      util: { value: 80, max: 100, color: "#762651", display: "80%" },
    });
  });

  it("emits empty charts/tables when those sheets are absent", async () => {
    const wb = new ExcelJS.Workbook();
    const meta = wb.addWorksheet("Meta");
    meta.addRow(["Field", "Value"]);
    meta.addRow(["week_start", "2026-06-08"]);
    meta.addRow(["default_bl", "tss"]);
    const bls = wb.addWorksheet("BusinessLines");
    bls.addRow(["id", "name", "accent", "is_sample", "order"]);
    bls.addRow(["tss", "TSS", "#762651", "N", 1]);
    const buffer = Buffer.from(await wb.xlsx.writeBuffer());

    const data = await parseWeeklyWorkbook(buffer);
    expect(dashboardDataSchema.safeParse(data).success).toBe(true);
    expect(data.businessLines[0]!.charts).toEqual([]);
    expect(data.businessLines[0]!.tables).toEqual([]);
    expect(data.businessLines[0]!.kpiGroups).toEqual([]);
  });
});
