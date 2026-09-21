/**
 * Arithmetic over a daily series, shared by the dashboard and the analytics page.
 *
 * It lives here rather than beside one of them because a KPI's delta has to be computed the same
 * way on both screens: two pages showing "New Signups" with different percentages under it is
 * worse than either page showing none.
 */

/** Sum of the last `size` entries. */
export function sumLast(values: number[], size: number): number {
  return values.slice(-size).reduce((sum, v) => sum + v, 0);
}

/**
 * Percentage change of the last `size` entries against the `size` before them.
 *
 * Null, not 0, when there is nothing to compare against — fewer than two periods of history, or
 * a previous period that summed to zero. A card with no comparable history has to say so, and
 * "+0%" says something else: that the figure held steady.
 */
export function deltaPercent(values: number[], size: number): number | null {
  if (size < 1 || values.length < size * 2) return null;
  const previous = sumLast(values.slice(0, -size), size);
  if (previous === 0) return null;
  return Math.round(((sumLast(values, size) - previous) / previous) * 100);
}

/** Eight buckets is what Sparkbars is drawn for; more than that and they stop reading. */
export function spark(values: number[], size: number): number[] {
  const window = values.slice(-size);
  const step = Math.max(Math.ceil(window.length / 8), 1);
  const buckets: number[] = [];
  for (let i = 0; i < window.length; i += step) {
    buckets.push(window.slice(i, i + step).reduce((sum, v) => sum + v, 0));
  }
  return buckets;
}
