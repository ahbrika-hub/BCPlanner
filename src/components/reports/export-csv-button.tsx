"use client";

import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { toCsv, type CsvRow } from "@/lib/reports/csv";

export type { CsvRow };

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
