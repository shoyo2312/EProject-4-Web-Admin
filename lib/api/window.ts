/**
 * The two header controls: how coarsely to bucket, and where the window ends.
 *
 * The analytics endpoints only take `days` — a count backwards from today, with no
 * end-date parameter — so an "as of" date is served by asking for a longer stretch and
 * cutting it here. That keeps the picker honest without a backend change.
 */

export type Granularity = "daily" | "weekly" | "monthly";

export const GRANULARITIES: readonly { value: Granularity; label: string }[] = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

/**
 * Granularity sets the span too. Twelve weekly bars off a 30-day window would be two
 * bars, so a separate length control would only ever be set to the one value that
 * makes the chart readable.
 */
export const SPAN_DAYS: Record<Granularity, number> = {
  daily: 30,
  weekly: 84,
  monthly: 365,
};

/** Suffix for "last 30d" style captions, so a weekly chart stops claiming days. */
export const BUCKET_UNIT: Record<Granularity, string> = {
  daily: "d",
  weekly: "w",
  monthly: "mo",
};

const DAY_MS = 24 * 60 * 60_000;

export function isoDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Whole days from `from` to `to`, never negative. */
export function daysBetween(from: string, to: string): number {
  const diff = Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`);
  return Math.max(Math.round(diff / DAY_MS), 0);
}

export function parseGranularity(value: string | undefined): Granularity {
  return GRANULARITIES.some((g) => g.value === value)
    ? (value as Granularity)
    : "daily";
}

/**
 * A date past `latest` would ask the API for a negative number of days, and one that
 * is not a date at all would poison every downstream slice, so both fall back to
 * `latest` rather than propagating.
 */
export function parseAsOf(value: string | undefined, latest: string): string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return latest;
  if (Number.isNaN(Date.parse(`${value}T00:00:00Z`))) return latest;
  return value > latest ? latest : value;
}

/** The analytics endpoints reject `days` above this. */
const API_MAX_DAYS = 365;

export interface TimeWindow {
  granularity: Granularity;
  /** Inclusive end of the window, YYYY-MM-DD. */
  asOf: string;
  /** Days of history the charts show. */
  spanDays: number;
  /** What to ask the API for: the window, plus the gap back from today to `asOf`. */
  fetchDays: number;
  /**
   * `fetchDays` plus one more span, so a KPI can be compared against the period
   * before it — clamped to what the API accepts.
   */
  compareDays: number;
}

export function resolveWindow(
  params: { g?: string; asOf?: string },
  latest: string,
): TimeWindow {
  const granularity = parseGranularity(params.g);
  const asOf = parseAsOf(params.asOf, latest);
  const spanDays = SPAN_DAYS[granularity];
  const fetchDays = daysBetween(asOf, latest) + spanDays;
  return {
    granularity,
    asOf,
    spanDays,
    fetchDays,
    compareDays: Math.min(fetchDays + spanDays, API_MAX_DAYS),
  };
}

/** Trims a daily series to the window: everything up to `asOf`, at most `spanDays` of it. */
export function sliceToWindow<T extends { day: string }>(
  rows: T[],
  window: TimeWindow,
): T[] {
  return rows.filter((r) => r.day <= window.asOf).slice(-window.spanDays);
}

/**
 * Weekly chunks are counted back from the end of the window, not from a calendar
 * Monday: the last bar must be the days leading up to `asOf`, or the newest bar is a
 * part-week that reads as a collapse in traffic.
 */
export function bucketByGranularity<T extends { day: string }>(
  rows: T[],
  granularity: Granularity,
  merge: (a: T, b: T) => T,
): T[] {
  if (granularity === "daily" || rows.length === 0) return rows;

  if (granularity === "weekly") {
    const out: T[] = [];
    for (let end = rows.length; end > 0; end -= 7) {
      const chunk = rows.slice(Math.max(end - 7, 0), end);
      out.unshift(chunk.reduce(merge));
    }
    return out;
  }

  const byMonth = new Map<string, T>();
  for (const row of rows) {
    const key = row.day.slice(0, 7);
    const current = byMonth.get(key);
    byMonth.set(key, current ? merge(current, row) : row);
  }
  return [...byMonth.values()];
}

/**
 * The `?page=` a Pager writes, as a zero-based index. Anything that is not a whole number at
 * or above 1 is page one: a hand-edited or stale value must not reach the backend as a
 * negative offset, and there is nothing useful to show for "page banana".
 */
export function parsePage(value: string | undefined): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return 0;
  return parsed - 1;
}
