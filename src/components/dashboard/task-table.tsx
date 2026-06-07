import Link from "next/link";

import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import type { Database } from "@/types/database.types";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type TaskStatus = Database["public"]["Enums"]["task_status"];

export type TaskTableRow = {
  id: string;
  title: string;
  status: TaskStatus;
  due_date?: string | null;
};

/**
 * Standardized dashboard task table. One recipe shared by the operational and
 * personal variants. The title column is sticky so the table can scroll
 * horizontally on narrow screens without losing context.
 */
export function TaskTable({
  rows,
  showDue = false,
  dueTone = "muted",
}: {
  rows: TaskTableRow[];
  showDue?: boolean;
  dueTone?: "muted" | "danger";
}) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="bg-card sticky left-0">Task</TableHead>
            <TableHead>Status</TableHead>
            {showDue && <TableHead className="text-right">Due</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((t) => (
            <TableRow key={t.id}>
              <TableCell className="bg-card sticky left-0 font-medium">
                <Link
                  href={`/tasks/${t.id}`}
                  className="hover:text-primary block max-w-[14rem] truncate hover:underline"
                >
                  {t.title}
                </Link>
              </TableCell>
              <TableCell>
                <StatusBadge status={t.status} />
              </TableCell>
              {showDue && (
                <TableCell
                  className={cn(
                    "text-right text-xs whitespace-nowrap",
                    dueTone === "danger" ? "text-danger" : "text-fg-muted",
                  )}
                >
                  {formatDate(t.due_date)}
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
