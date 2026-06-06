"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Error boundary for the authenticated app group. Turns an unexpected
 * server/render error (e.g. a transient database issue) into a friendly,
 * recoverable screen instead of the stark default 500.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <AlertTriangle className="text-danger size-10" aria-hidden="true" />
      <div>
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="text-muted-foreground mt-1 max-w-sm text-sm">
          We couldn&apos;t load this page. Please try again — if it keeps
          happening, contact an administrator.
        </p>
        {error.digest && (
          <p className="text-muted-foreground mt-2 text-xs">
            Ref: {error.digest}
          </p>
        )}
      </div>
      <div className="flex gap-2">
        <Button onClick={reset}>Try again</Button>
        <Button asChild variant="outline">
          <Link href="/dashboard">Back to dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
