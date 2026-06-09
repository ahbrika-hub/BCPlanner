"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";
import { initials } from "@/lib/dashboard/format";

export type SelectorLine = {
  id: string;
  name: string;
  accent: string;
  logoUrl?: string;
};

/**
 * Logo (or branded initials chip) for one business line. Resolution order:
 * explicit logoUrl override → public/business-lines/<id>.svg → .png → .jpg →
 * .jpeg → chip.
 * Looks complete with zero logo assets.
 */
function LineLogo({ line, active }: { line: SelectorLine; active: boolean }) {
  const sources = [
    line.logoUrl,
    `/business-lines/${line.id}.svg`,
    `/business-lines/${line.id}.png`,
    `/business-lines/${line.id}.jpg`,
    `/business-lines/${line.id}.jpeg`,
  ].filter(Boolean) as string[];
  const [idx, setIdx] = useState(0);

  if (idx >= sources.length) {
    // Branded initials chip fallback.
    return (
      <span
        aria-hidden="true"
        className="flex size-9 items-center justify-center rounded-md text-xs font-bold text-white"
        style={{ backgroundColor: line.accent }}
      >
        {initials(line.name)}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={sources[idx]}
      alt=""
      aria-hidden="true"
      className={cn(
        "h-9 w-auto max-w-[120px] object-contain transition-opacity",
        active ? "opacity-100" : "opacity-70 grayscale",
      )}
      onError={() => setIdx((i) => i + 1)}
    />
  );
}

/**
 * Clickable business-line filter rendered as logo buttons (replaces text tabs).
 * Accessible: role="tablist" with role="tab" buttons, keyboard navigable.
 */
export function BusinessLineSelector({
  lines,
  active,
  onSelect,
}: {
  lines: SelectorLine[];
  active: string;
  onSelect: (id: string) => void;
}) {
  function onKeyDown(e: React.KeyboardEvent, i: number) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const next =
      e.key === "ArrowRight"
        ? (i + 1) % lines.length
        : (i - 1 + lines.length) % lines.length;
    onSelect(lines[next]!.id);
    const el = document.getElementById(`bl-tab-${lines[next]!.id}`);
    el?.focus();
  }

  return (
    <div
      role="tablist"
      aria-label="Business line"
      className="flex flex-wrap gap-2"
    >
      {lines.map((line, i) => {
        const isActive = line.id === active;
        return (
          <button
            key={line.id}
            id={`bl-tab-${line.id}`}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-label={line.name}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onSelect(line.id)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cn(
              "bg-card focus-visible:ring-ring/50 flex h-14 min-w-[88px] items-center justify-center rounded-lg border px-3 outline-none focus-visible:ring-2",
              "transition-colors motion-reduce:transition-none",
              isActive ? "border-2 shadow-sm" : "border-border hover:bg-muted",
            )}
            style={isActive ? { borderColor: line.accent } : undefined}
          >
            <LineLogo line={line} active={isActive} />
          </button>
        );
      })}
    </div>
  );
}
