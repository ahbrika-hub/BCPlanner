"use client";

import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";

export type CsvRow = Record<string, string | number | null>;

function toCsv(rows: CsvRow[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]!);
  const escape = (v: string | number | null) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => escape(r[h] ?? "")).join(",")),
  ];
  return lines.join("\n");
}

export function ExportCsvButton({
  rows,
  filename = "tss-planner-report.csv",
}: {
  rows: CsvRow[];
  filename?: string;
}) {
  const onClick = () => {
    const blob = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onClick}
      disabled={rows.length === 0}
    >
      <Download className="size-4" />
      Export CSV
    </Button>
  );
}
