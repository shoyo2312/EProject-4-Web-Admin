import type {
  DailyActiveUsersResponse,
  DailyCountResponse,
  DailySignupResponse,
  TopVideoResponse,
} from "@/lib/api/types";
import { MOCK_NOW, between, seededRandom } from "./random";

const DAY_MS = 24 * 60 * 60_000;

function dayString(daysAgo: number) {
  return new Date(MOCK_NOW - daysAgo * DAY_MS).toISOString().slice(0, 10);
}

/**
 * GET /api/v1/analytics/engagement/daily returns one row per (day, eventType),
 * so a 7-day window is 35 rows. Shape it the same way here — the rollup in
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
    // Event names are the ones analytics-service writes to ClickHouse, past tense.
    // Getting these wrong is silent: the rollup just files everything under the
    // wrong segment and the chart still renders.
    const likes = Math.round(between(rand, 38_000, 96_000) * swing);
    rows.push({ day, eventType: "LIKED", count: likes });
    rows.push({
      day,
      eventType: "UNLIKED",
      count: Math.round(likes * between(rand, 0.02, 0.07)),
    });
    rows.push({
      day,
      eventType: "COMMENTED",
      count: Math.round(between(rand, 6_000, 19_000) * swing),
    });
    rows.push({
      day,
      eventType: "SHARED",
      count: Math.round(between(rand, 2_000, 9_000) * swing),
    });
    rows.push({
      day,
      eventType: "PUBLISHED",
      count: Math.round(between(rand, 400, 1_600) * swing),
    });
  }
  return rows;
}

export function mockDailySignups(days = 7): DailySignupResponse[] {
  const rand = seededRandom(31337 + days);
  return Array.from({ length: days }, (_, i) => ({
    day: dayString(days - 1 - i),
    signups: between(rand, 380, 940),
  }));
}

/**
 * Daily active users. Shaped like the signup series — weekend dip, steady growth — because the
 * point of the mock is that the chart looks like a chart, not that the numbers are anyone's.
 */
export function mockDailyActiveUsers(days = 7): DailyActiveUsersResponse[] {
  const rand = seededRandom(8181 + days);
  const rows: DailyActiveUsersResponse[] = [];
  for (let d = days - 1; d >= 0; d--) {
    const date = new Date(MOCK_NOW - d * DAY_MS);
    const weekend = date.getUTCDay() % 6 === 0;
    const age = (days - 1 - d) / Math.max(days - 1, 1);
    const base = 600 + age * 420;
    rows.push({
      day: dayString(d),
      activeUsers: Math.round(base * (weekend ? 1.25 : 1) + between(rand, 0, 90)),
    });
  }
  return rows;
}

/** Most-watched videos, already ordered by watched time the way ClickHouse returns them. */
export function mockTopVideos(limit = 20): TopVideoResponse[] {
  const rand = seededRandom(9393);
  return Array.from({ length: limit }, (_, i) => {
    const views = between(rand, 400, 9000) + (limit - i) * 250;
    return {
      videoId: `video_${i + 1}`,
      views,
      watchedMs: views * between(rand, 4_000, 22_000),
      completions: Math.round(views * (between(rand, 15, 70) / 100)),
      viewers: Math.round(views * (between(rand, 55, 95) / 100)),
    };
  }).sort((a, b) => b.watchedMs - a.watchedMs);
}
