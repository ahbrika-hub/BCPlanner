"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";

const SOURCES = ["/brand/tss-logo.svg", "/brand/tss-logo.png"];

/**
 * TSS brand lockup for auth screens. Resolves the logo by extension —
 * /brand/tss-logo.svg → .png — and falls back to the text wordmark when neither
 * is present (mirrors the business-line selector's logo resolution).
 */
export function TssLogo({ className }: { className?: string }) {
  const [idx, setIdx] = useState(0);

  if (idx >= SOURCES.length) {
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
      src={SOURCES[idx]}
      alt="TSS Planner"
      className={cn("h-12 w-auto", className)}
      onError={() => setIdx((i) => i + 1)}
    />
  );
}
