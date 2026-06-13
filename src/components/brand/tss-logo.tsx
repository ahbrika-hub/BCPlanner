"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";

/**
 * Logo source resolution, in priority order. We lead with the committed PNG
 * (`/brand/tss-logo.png`) rather than an `.svg` that isn't in the repo: leading
 * with a missing file made the first paint a guaranteed 404 whose `onError`
 * could fire before hydration attached the handler, leaving the broken image —
 * the intermittent disappearance. Leading with the real asset makes first paint
 * deterministic; the text wordmark remains the final fallback. If an `.svg` is
 * ever committed, prepend it here.
 */
export const LOGO_SOURCES = ["/brand/tss-logo.png"] as const;

/**
 * TSS brand logo — resolves {@link LOGO_SOURCES} and falls back to a wordmark
 * (or a caller-supplied `fallback`) when no image is present. Shared by the auth
 * screens and the app-shell brand lockup so the resolution + fallback never
 * drift.
 */
export function TssLogo({
  className,
  fallback,
}: {
  className?: string;
  fallback?: React.ReactNode;
}) {
  const [idx, setIdx] = useState(0);

  if (idx >= LOGO_SOURCES.length) {
    return (
      fallback ?? (
        <span className="text-primary text-2xl font-semibold tracking-tight">
          TSS Planner
        </span>
      )
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={LOGO_SOURCES[idx]}
      alt="TSS Planner"
      className={cn("h-12 w-auto", className)}
      onError={() => setIdx((i) => i + 1)}
    />
  );
}
