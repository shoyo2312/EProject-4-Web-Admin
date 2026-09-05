import type { DailyCountResponse } from "./types";

/**
 * "Yearly" from the original design is not offered: the analytics tables are populated
 * by Kafka consumers that started with this deployment, so there is no multi-year
 * history to bucket. Daily is the range an on-call moderator actually reads.
 */
export type MosaicRange = "daily" | "weekly" | "monthly";

export interface MosaicBucket {
  label: string;
  /** Dark segment, stacked from the bottom */
  primary: number;
  /** Mid-grey segment above it */
  secondary: number;
}

export type MosaicSeries = Record<MosaicRange, MosaicBucket[]>;

const MONTH_LABELS = [
  "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
  "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
];

const DAY_MS = 24 * 60 * 60_000;

interface Totals {
  primary: number;
  secondary: number;
}

function emptyTotals(): Totals {
  return { primary: 0, secondary: 0 };
}

/**
 * event_type values as analytics-service writes them into ClickHouse — see the
 * consumers in com.tiktok.analyticsservice.event.consumer. They are past tense,
 * not the bare verb, and UNLIKED is a real row rather than a decrement.
 */
function addRow(totals: Totals, row: DailyCountResponse) {
  // Likes dominate by an order of magnitude, so they get the dark segment and
  // the two conversational signals share the lighter one. PUBLISHED is an upload,
  // not engagement, so it is left out of the trend entirely.
  if (row.eventType === "LIKED") totals.primary += row.count;
  else if (row.eventType === "UNLIKED") totals.primary -= row.count;
  else if (row.eventType === "COMMENTED" || row.eventType === "SHARED") {
    totals.secondary += row.count;
  }
}

/** A day with more unlikes than likes would otherwise render as a negative bar. */
function clamp(totals: Totals): Totals {
  return { primary: Math.max(totals.primary, 0), secondary: totals.secondary };
}

/**
 * Rolls a flat list of (day, eventType, count) rows — exactly what
 * GET /api/v1/analytics/engagement/daily returns — into the three ranges the
 * mosaic chart toggles between. Done once on the server so switching range is instant.
 */
export function toMosaicSeries(
  rows: DailyCountResponse[],
  now = Date.now(),
): MosaicSeries {
  const byDay = new Map<string, Totals>();
  for (const row of rows) {
    const totals = byDay.get(row.day) ?? emptyTotals();
    addRow(totals, row);
    byDay.set(row.day, totals);
  }

  const dayKey = (offsetDays: number) =>
    new Date(now - offsetDays * DAY_MS).toISOString().slice(0, 10);

  // Last 14 days, oldest first
  const daily: MosaicBucket[] = Array.from({ length: 14 }, (_, i) => {
    const key = dayKey(13 - i);
    const totals = clamp(byDay.get(key) ?? emptyTotals());
    return { label: key.slice(8), ...totals };
  });

  // Last 12 weeks
  const weekly: MosaicBucket[] = Array.from({ length: 12 }, (_, i) => {
    const totals = emptyTotals();
    const weeksAgo = 11 - i;
    for (let d = 0; d < 7; d++) {
      const bucket = byDay.get(dayKey(weeksAgo * 7 + d));
      if (bucket) {
        totals.primary += bucket.primary;
        totals.secondary += bucket.secondary;
      }
    }
    return { label: `W${i + 1}`, ...clamp(totals) };
  });

  // Last 12 calendar months, oldest first
  const monthTotals = new Map<string, Totals>();
  for (const [day, totals] of byDay) {
    const monthKey = day.slice(0, 7);
    const acc = monthTotals.get(monthKey) ?? emptyTotals();
    acc.primary += totals.primary;
    acc.secondary += totals.secondary;
    monthTotals.set(monthKey, acc);
  }

  const current = new Date(now);
  const monthly: MosaicBucket[] = Array.from({ length: 12 }, (_, i) => {
    const date = new Date(
      Date.UTC(current.getUTCFullYear(), current.getUTCMonth() - (11 - i), 1),
    );
    const key = date.toISOString().slice(0, 7);
    return {
      label: MONTH_LABELS[date.getUTCMonth()],
      ...clamp(monthTotals.get(key) ?? emptyTotals()),
    };
  });

  return { daily, weekly, monthly };
}

export interface EngagementMixRow {
  eventType: string;
  label: string;
  total: number;
  /** Bar width relative to the largest row, not a share of the whole. */
  weight: number;
}

const MIX_LABELS: Record<string, string> = {
  LIKED: "Likes",
  UNLIKED: "Unlikes",
  COMMENTED: "Comments",
  SHARED: "Shares",
  PUBLISHED: "Videos published",
};

/**
 * Same rows as the mosaic, counted per event type instead of per day. This is the
 * one view where UNLIKED and PUBLISHED are worth seeing on their own — a rising
 * unlike count is invisible once it has been netted off against likes.
 */
export function toEngagementMix(rows: DailyCountResponse[]): EngagementMixRow[] {
  const totals = new Map<string, number>();
  for (const row of rows) {
    totals.set(row.eventType, (totals.get(row.eventType) ?? 0) + row.count);
  }

  const peak = Math.max(...totals.values(), 1);
  return Array.from(totals, ([eventType, total]) => ({
    eventType,
    label: MIX_LABELS[eventType] ?? eventType,
    total,
    weight: total / peak,
  })).sort((a, b) => b.total - a.total);
}
