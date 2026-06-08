// Generates docs/templates/weekly-dashboard-template.xlsx — the blank template
// the upstream platform fills in. Run: node scripts/gen-dashboard-template.mjs
import ExcelJS from "exceljs";
import { mkdirSync } from "node:fs";
import path from "node:path";

const wb = new ExcelJS.Workbook();
wb.creator = "BCPlanner";

function sheet(name, headers, sample = []) {
  const ws = wb.addWorksheet(name);
  ws.addRow(headers).font = { bold: true };
  for (const row of sample) ws.addRow(row);
  ws.columns.forEach((c) => (c.width = 18));
}

sheet(
  "Meta",
  ["Field", "Value"],
  [
    ["week_start", "2026-06-01"],
    ["title", "TSS Weekly Dashboard"],
    ["subtitle", "Week of 1 Jun 2026"],
    ["last_refreshed", "2026-06-01 09:00"],
    ["foot_left", "Confidential"],
    ["foot_right", "Generated weekly"],
    ["default_bl", "tss"],
    ["default_period", "week"],
  ],
);

sheet(
  "BusinessLines",
  ["id", "name", "accent", "is_sample", "order"],
  [["tss", "TSS", "#762651", "N", 1]],
);

sheet(
  "KPIs",
  [
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
  ],
  [
    [
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
      98,
      100,
      "K",
      "Strong",
      "core",
      "AR",
    ],
    [
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
    ],
    [
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
    ],
  ],
);

sheet(
  "Charts",
  [
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
  ],
  [
    [
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
    ],
    [
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
    ],
    [
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
    ],
    [
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
    ],
    [
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
    ],
    [
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
    ],
  ],
);

sheet(
  "Tables",
  [
    "business_line_id",
    "table_id",
    "table_title",
    "column_order",
    "column_key",
    "column_label",
    "column_kind",
  ],
  [
    ["tss", "perf", "Performance", 1, "name", "Name", "text"],
    ["tss", "perf", "Performance", 2, "score", "Score", "num"],
    ["tss", "perf", "Performance", 3, "status", "Status", "rag"],
    ["tss", "perf", "Performance", 4, "util", "Utilization", "minibar"],
    ["tss", "perf", "Performance", 5, "share", "Share", "share"],
  ],
);

sheet(
  "T_perf",
  ["name", "score", "status", "util", "share"],
  [
    [
      "Amal Rashid",
      4.6,
      "green|On track",
      "80|100|#762651|80%",
      "62|#762651|of team",
    ],
    [
      "Yousef Haddad",
      3.8,
      "amber|Watch",
      "55|100|#193560|55%",
      "38|#193560|of team",
    ],
  ],
);

const out = path.resolve("docs/templates/weekly-dashboard-template.xlsx");
mkdirSync(path.dirname(out), { recursive: true });
await wb.xlsx.writeFile(out);
console.log("Wrote", out);
