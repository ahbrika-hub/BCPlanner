"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";

/**
 * TSS brand lockup for auth screens. Renders /brand/tss-logo.svg when the asset
 * is present; falls back to the text wordmark on load error (so the build is
 * complete with zero logo assets).
 */
export function TssLogo({ className }: { className?: string }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <span
        className={cn(
          "text-primary text-2xl font-semibold tracking-tight",
          className,
        )}
      >
        TSS Planner
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/brand/tss-logo.svg"
      alt="TSS Planner"
      className={cn("h-12 w-auto", className)}
      onError={() => setFailed(true)}
    />
  );
}
