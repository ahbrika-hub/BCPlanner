"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { X } from "lucide-react";

import { formatDateTime } from "@/lib/format";
import type { AuditLogWithActor } from "@/lib/data/audit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function AuditView({
  rows,
  total,
  page,
  pageSize,
}: {
  rows: AuditLogWithActor[];
  total: number;
  page: number;
  pageSize: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [detail, setDetail] = useState<AuditLogWithActor | null>(null);

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page");
    router.push(`${pathname}?${next.toString()}`);
  };

  const goPage = (p: number) => {
    const next = new URLSearchParams(params.toString());
    next.set("page", String(p));
    router.push(`${pathname}?${next.toString()}`);
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const hasFilters = ["entity_type", "action", "from", "to"].some((k) =>
    params.get(k),
  );

  return (
    <>
      <div className="mb-4 flex flex-wrap items-end gap-2">
        <Input
          placeholder="Entity type (e.g. task)"
          defaultValue={params.get("entity_type") ?? ""}
          className="w-44"
          onKeyDown={(e) => {
            if (e.key === "Enter")
              setParam(
                "entity_type",
                (e.target as HTMLInputElement).value || null,
              );
          }}
        />
        <Input
          placeholder="Action (e.g. task.status_changed)"
          defaultValue={params.get("action") ?? ""}
          className="w-60"
          onKeyDown={(e) => {
            if (e.key === "Enter")
              setParam("action", (e.target as HTMLInputElement).value || null);
          }}
        />
        <Input
          type="date"
          defaultValue={params.get("from") ?? ""}
          className="w-40"
          onChange={(e) => setParam("from", e.target.value || null)}
        />
        <Input
          type="date"
          defaultValue={params.get("to") ?? ""}
          className="w-40"
          onChange={(e) => setParam("to", e.target.value || null)}
        />
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(pathname)}
          >
            <X className="size-4" />
            Clear
          </Button>
        )}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="No audit entries"
          description="Nothing matches these filters."
        />
      ) : (
        <>
          <div className="rounded-lg border">
            <Table stickyFirstColumn>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead className="text-right">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-sm">
                      {formatDateTime(r.created_at)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {r.actor?.full_name ?? "System"}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {r.action}
                    </TableCell>
                    <TableCell className="text-sm">
                      {r.entity_type === "task" && r.entity_id ? (
                        <Link
                          href={`/tasks/${r.entity_id}`}
                          className="hover:underline"
                        >
                          {r.entity_type}
                        </Link>
                      ) : (
                        r.entity_type
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDetail(r)}
                      >
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="mt-4 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Page {page} of {totalPages} · {total} entries
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => goPage(page - 1)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => goPage(page + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}

      <Dialog
        open={detail !== null}
        onOpenChange={(o) => !o && setDetail(null)}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{detail?.action}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-muted-foreground mb-1 text-xs font-medium">
                Before
              </p>
              <pre className="bg-muted max-h-64 overflow-auto rounded-md p-3 text-xs">
                {JSON.stringify(detail?.before_data ?? null, null, 2)}
              </pre>
            </div>
            <div>
              <p className="text-muted-foreground mb-1 text-xs font-medium">
                After
              </p>
              <pre className="bg-muted max-h-64 overflow-auto rounded-md p-3 text-xs">
                {JSON.stringify(detail?.after_data ?? null, null, 2)}
              </pre>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
