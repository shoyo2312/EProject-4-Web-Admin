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

/**
 * Growth of a running total against the period before it, from the total itself and how much
 * of it arrived during the period.
 *
 * A cumulative figure — accounts on the platform, videos in the library — has no series
 * behind it, so `deltaPercent` cannot speak for it: comparing this period's arrivals against
 * last period's is a claim about the flow, not about the total. What the total grew by is
 * `inflow / (total - inflow)`, the size it had when the period began.
 *
 * Null when that starting size is zero or negative: everything that exists arrived in this
 * period, which is not a percentage, and a negative comes from a total and an inflow counted
 * over different sets — better to show nothing than a figure built from a mismatch.
 */
export function growthPercent(total: number, inflow: number): number | null {
  const before = total - inflow;
  if (before <= 0) return null;
  return Math.round((inflow / before) * 100);
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
