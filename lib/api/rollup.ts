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

function addRow(totals: Totals, row: DailyCountResponse) {
  // Likes dominate by an order of magnitude, so they get the dark segment and
  // the two conversational signals share the lighter one.
  if (row.eventType === "LIKE") totals.primary += row.count;
  else totals.secondary += row.count;
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
    const totals = byDay.get(key) ?? emptyTotals();
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
    return { label: `W${i + 1}`, ...totals };
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
      ...(monthTotals.get(key) ?? emptyTotals()),
    };
  });

  return { daily, weekly, monthly };
}
