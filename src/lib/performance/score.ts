export type PerformanceMetrics = {
  assigned_count: number;
  completed_count: number;
  delayed_count: number;
  quality_avg_rating: number | null;
};

/**
 * Overall performance score (0–100), confirmed 40/30/30 formula:
 *   (completed/total)*40 + (qualityAvg/5)*30 + (1 − delayed/total)*30
 * Returns 0 when there are no assigned tasks (guards divide-by-zero).
 * Rounded to one decimal place.
 */
export function calculatePerformanceScore(m: PerformanceMetrics): number {
  const total = m.assigned_count;
  if (!total || total <= 0) return 0;

  const completionPart = (m.completed_count / total) * 40;
  const qualityPart = ((m.quality_avg_rating ?? 0) / 5) * 30;
  const delayPart = (1 - m.delayed_count / total) * 30;

  const score = completionPart + qualityPart + delayPart;
  return Math.round(score * 10) / 10;
}
