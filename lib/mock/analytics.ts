import type {
  DailyCountResponse,
  DailyRevenueResponse,
  DailySignupResponse,
} from "@/lib/api/types";
import { MOCK_NOW, between, seededRandom } from "./random";

const DAY_MS = 24 * 60 * 60_000;

function dayString(daysAgo: number) {
  return new Date(MOCK_NOW - daysAgo * DAY_MS).toISOString().slice(0, 10);
}

/**
 * GET /api/v1/analytics/engagement/daily returns one row per (day, eventType),
 * so a 7-day window is 21 rows. Shape it the same way here — the rollup in
 * lib/api/rollup.ts then runs over mock and live data identically.
 */
export function mockDailyEngagement(days = 7): DailyCountResponse[] {
  const rand = seededRandom(4242 + days);
  const rows: DailyCountResponse[] = [];
  for (let d = days - 1; d >= 0; d--) {
    const day = dayString(d);
    const date = new Date(MOCK_NOW - d * DAY_MS);
    // Weekly rhythm + steady growth + a seasonal wave. A flat random series rolls up
    // into twelve identical monthly columns, which makes the mosaic unreadable —
    // and no real platform looks like that anyway.
    const weekend = date.getUTCDay() % 6 === 0;
    const age = (days - 1 - d) / Math.max(days - 1, 1); // 0 = oldest, 1 = today
    const growth = 0.45 + age * 0.95;
    const seasonal = 1 + 0.35 * Math.sin((age * 365 * Math.PI * 2) / 190);
    const swing = (weekend ? 1.35 : 1) * growth * seasonal;
    rows.push({
      day,
      eventType: "LIKE",
      count: Math.round(between(rand, 38_000, 96_000) * swing),
    });
    rows.push({
      day,
      eventType: "COMMENT",
      count: Math.round(between(rand, 6_000, 19_000) * swing),
    });
    rows.push({
      day,
      eventType: "SHARE",
      count: Math.round(between(rand, 2_000, 9_000) * swing),
    });
  }
  return rows;
}

export function mockDailyRevenue(days = 30): DailyRevenueResponse[] {
  const rand = seededRandom(9001 + days);
  return Array.from({ length: days }, (_, i) => {
    const d = days - 1 - i;
    const ordersCreated = between(rand, 180, 640);
    const paymentsCompleted = Math.round(ordersCreated * (0.6 + rand() * 0.3));
    return {
      day: dayString(d),
      ordersCreated,
      paymentsCompleted,
      revenue: (paymentsCompleted * between(rand, 18, 74)).toFixed(2),
    };
  });
}

export function mockDailySignups(days = 7): DailySignupResponse[] {
  const rand = seededRandom(31337 + days);
  return Array.from({ length: days }, (_, i) => ({
    day: dayString(days - 1 - i),
    signups: between(rand, 380, 940),
  }));
}
