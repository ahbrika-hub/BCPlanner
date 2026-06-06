/** Current period label, e.g. "2026-Q2" (UTC). */
export function currentPeriod(date = new Date()): string {
  const q = Math.floor(date.getUTCMonth() / 3) + 1;
  return `${date.getUTCFullYear()}-Q${q}`;
}

/** The most recent `count` period labels, newest first. */
export function recentPeriods(count = 8, date = new Date()): string[] {
  const out: string[] = [];
  let year = date.getUTCFullYear();
  let q = Math.floor(date.getUTCMonth() / 3) + 1;
  for (let i = 0; i < count; i++) {
    out.push(`${year}-Q${q}`);
    q -= 1;
    if (q === 0) {
      q = 4;
      year -= 1;
    }
  }
  return out;
}
