/**
 * The two header controls: which period every figure on the page covers, and where that
 * period ends.
 *
 * The period is one control, not two, because it answers both questions a dated console asks:
 * how much of a figure to show, and what to compare it against. Picking "Month" means a
 * figure covering the last 30 days with a percentage against the 30 before it — a separate
 * "compare against" control could be set to disagree with the figure above it, and then the
 * percentage is describing a period the number is not.
 *
 * The analytics endpoints only take `days` — a count backwards from today, with no end-date
 * parameter — so an "as of" date is served by asking for a longer stretch and cutting it here.
 */

/** How the charts bucket their bars. Independent of the period: see `CHART` below. */
export type Granularity = "daily" | "weekly" | "monthly";

/** The period a figure covers, and the length of the period it is compared against. */
export type Period = "day" | "week" | "month" | "year";

export const PERIODS: readonly { value: Period; label: string }[] = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "year", label: "Year" },
];

const PERIOD_DAYS: Record<Period, number> = {
  day: 1,
  week: 7,
  month: 30,
  year: 365,
};

/** The grey caption under a figure, saying how much time it covers. */
const PERIOD_LABEL: Record<Period, string> = {
  day: "Last 24h",
  week: "Last 7d",
  month: "Last 30d",
  year: "Last 365d",
};

/** What the delta footer says it is comparing against. */
const COMPARE_LABEL: Record<Period, string> = {
  day: "vs yesterday",
  week: "vs last week",
  month: "vs last month",
  year: "vs last year",
};

/**
 * How a chart is drawn for each period, which is not the period itself.
 *
 * A one-day period would be a one-bar chart, and 365 daily bars is a smear — so the chart
 * shows the longest stretch that still reads at that resolution. Month and year draw the same
 * chart on purpose: 365 days is the widest window the engagement rollup pulls, and a
 * thirty-six-bar version of it would be the same picture stretched.
 */
const CHART: Record<Period, { bucket: Granularity; days: number }> = {
  day: { bucket: "daily", days: 30 },
  week: { bucket: "weekly", days: 84 },
  month: { bucket: "monthly", days: 365 },
  year: { bucket: "monthly", days: 365 },
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

export function parsePeriod(value: string | undefined): Period {
  return PERIODS.some((p) => p.value === value) ? (value as Period) : "month";
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

/**
 * The longest window every dated endpoint accepts. Three years, so a year-over-year delta
 * can ask for the year before the one on screen — see the `@Max` on AnalyticsController,
 * ModerationActionController and AdminVideoController, which have to agree with this.
 */
const API_MAX_DAYS = 1095;

export interface TimeWindow {
  period: Period;
  /** Bucket size for the page's charts — derived from the period, not picked separately. */
  bucket: Granularity;
  /** Inclusive end of the window, YYYY-MM-DD. */
  asOf: string;
  /** Days a KPI figure covers, and the length of the period behind it it is compared to. */
  periodDays: number;
  /** "Last 30d" and friends — the caption under a figure covering exactly one period. */
  periodLabel: string;
  /** Days of history the charts show. */
  chartDays: number;
  /** "vs last month" and friends — what the delta under a figure is claiming. */
  compareLabel: string;
  /**
   * What to ask the API for: the gap back from today to `asOf`, plus whichever is longer —
   * the chart's stretch, or two periods so a figure has something to compare against.
   */
  fetchDays: number;
}

export function resolveWindow(
  params: { p?: string; asOf?: string },
  latest: string,
): TimeWindow {
  const period = parsePeriod(params.p);
  const asOf = parseAsOf(params.asOf, latest);
  const periodDays = PERIOD_DAYS[period];
  const chart = CHART[period];
  const gap = daysBetween(asOf, latest);
  return {
    period,
    bucket: chart.bucket,
    asOf,
    periodDays,
    periodLabel: PERIOD_LABEL[period],
    chartDays: chart.days,
    compareLabel: COMPARE_LABEL[period],
    fetchDays: Math.min(gap + Math.max(chart.days, periodDays * 2), API_MAX_DAYS),
  };
}

/** Trims a daily series to the chart window: everything up to `asOf`, at most `chartDays` of it. */
export function sliceToWindow<T extends { day: string }>(
  rows: T[],
  window: TimeWindow,
): T[] {
  return rows.filter((r) => r.day <= window.asOf).slice(-window.chartDays);
}

/**
 * The part of a daily series a delta is computed over: everything up to `asOf`, uncut, so the
 * two periods behind it are still there. Cutting to the window first would leave nothing to
 * compare against.
 */
export function historyUpTo<T extends { day: string }>(
  rows: T[],
  window: TimeWindow,
): T[] {
  return rows.filter((r) => r.day <= window.asOf);
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
