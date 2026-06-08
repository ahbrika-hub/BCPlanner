import type { Rag } from "@/lib/validations/dashboard";

/** Compact money: 1_234_567 → "1.2M", 98_000 → "98K". */
export function moneyShort(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${Math.round(n / 1e3)}K`;
  return String(n);
}

export function fmtNum(n: number): string {
  return new Intl.NumberFormat(undefined).format(n);
}

/** Direction implied by a delta string (e.g. "+6%", "-3", "0"). */
export function arrow(delta: string | undefined): "up" | "down" | "flat" {
  const t = (delta ?? "").trim();
  if (t.startsWith("+")) return "up";
  if (t.startsWith("-") || t.startsWith("−")) return "down";
  const n = Number(t.replace(/[^0-9.-]/g, ""));
  if (Number.isFinite(n) && n > 0) return "up";
  if (Number.isFinite(n) && n < 0) return "down";
  return "flat";
}

/** rag → a CSS colour token. */
export function ragColor(rag: Rag): string {
  return rag === "green"
    ? "var(--color-success)"
    : rag === "amber"
      ? "var(--color-warning)"
      : "var(--color-danger)";
}

/** Format a numeric chart/axis value by its value kind. */
export function fmtValue(n: number, kind: "currency" | "count"): string {
  return kind === "currency" ? `SAR ${moneyShort(n)}` : fmtNum(n);
}

/** Initials for the logo fallback chip. */
export function initials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] ?? "?").concat(parts[1]?.[0] ?? "").toUpperCase();
}
