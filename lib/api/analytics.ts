import "server-only";

import { apiGet } from "./client";
import { USE_MOCK } from "./config";
import { toMosaicSeries, type MosaicSeries } from "./rollup";
import { referenceNow } from "./shared";
import type {
  DailyActiveUsersResponse,
  DailyAdminStatsResponse,
  DailyCountResponse,
  DailySignupResponse,
  DailyVideoStatsResponse,
  StatsSummaryResponse,
  TopVideoResponse,
  VideoEngagementSummaryResponse,
} from "./types";
import {
  mockDailyActiveUsers,
  mockDailyEngagement,
  mockDailySignups,
  mockTopVideos,
} from "@/lib/mock/analytics";
import { mockDailyAdminStats, mockStatsSummary } from "@/lib/mock/moderation";
import { mockDailyVideoStats, mockVideos } from "@/lib/mock/videos";

export async function getStatsSummary(): Promise<StatsSummaryResponse> {
  if (USE_MOCK) return mockStatsSummary;
  return apiGet<StatsSummaryResponse>("/api/v1/admin/stats/summary");
}

/**
 * The moderation flow per day — reports filed and closed, actions taken by kind. Every
 * period-over-period percentage on a moderation figure is computed from this one series,
 * which is why it comes back as one call rather than a count per card.
 */
export async function getDailyAdminStats(days = 7): Promise<DailyAdminStatsResponse[]> {
  if (USE_MOCK) return mockDailyAdminStats(days);
  return apiGet<DailyAdminStatsResponse[]>(`/api/v1/admin/stats/daily?days=${days}`);
}

/**
 * Uploads per day, with each day's cohort standing. video-service owns this rather than
 * analytics-service because the two cohort counts are read off the videos' current status,
 * which only the library itself holds.
 */
export async function getDailyVideoStats(days = 7): Promise<DailyVideoStatsResponse[]> {
  if (USE_MOCK) return mockDailyVideoStats(days);
  return apiGet<DailyVideoStatsResponse[]>(`/api/v1/videos/admin/stats/daily?days=${days}`);
}

export async function getDailyEngagement(days = 7): Promise<DailyCountResponse[]> {
  if (USE_MOCK) return mockDailyEngagement(days);
  return apiGet<DailyCountResponse[]>(`/api/v1/analytics/engagement/daily?days=${days}`);
}

/**
 * One 365-day pull rolled up into all three chart ranges, so the Daily/Weekly/Monthly
 * toggle is instant instead of a refetch per click.
 */
export async function getEngagementSeries(asOfMs = referenceNow()): Promise<MosaicSeries> {
  const rows = await getDailyEngagement(365);
  return toMosaicSeries(rows, asOfMs);
}

/**
 * The analytics page reads one engagement pull three ways — bucketed for the trend, per day for
 * the period's figure, totalled by type for the mix — so it gets the trend and the rows, and cuts
 * the rows to its own period. At least the 365 days the monthly trend needs, and further back when
 * the period's comparison reaches past that: a year compared with the year before needs two.
 */
export async function getEngagementOverview(
  asOfMs = referenceNow(),
  days = 365,
): Promise<{ series: MosaicSeries; rows: DailyCountResponse[] }> {
  const rows = await getDailyEngagement(Math.max(days, 365));
  return { series: toMosaicSeries(rows, asOfMs), rows };
}

export async function getDailySignups(days = 7): Promise<DailySignupResponse[]> {
  if (USE_MOCK) return mockDailySignups(days);
  return apiGet<DailySignupResponse[]>(`/api/v1/analytics/signups/daily?days=${days}`);
}

/**
 * Distinct viewers per day, from watch events.
 *
 * Not derivable from anything the console already pulls: engagement counts actions, and the
 * people who watch without liking anything — most of them — appear in none of them.
 */
export async function getDailyActiveUsers(days = 7): Promise<DailyActiveUsersResponse[]> {
  if (USE_MOCK) return mockDailyActiveUsers(days);
  return apiGet<DailyActiveUsersResponse[]>(`/api/v1/analytics/active-users/daily?days=${days}`);
}

/**
 * The most-watched videos of the `days` before `until` (an ISO instant, end exclusive), or before
 * now without one — ordered by time spent rather than by view count.
 */
export async function getTopVideos(
  days = 7,
  limit = 20,
  until?: string,
): Promise<TopVideoResponse[]> {
  if (USE_MOCK) return mockTopVideos(limit);
  const params = new URLSearchParams({ days: String(days), limit: String(limit) });
  if (until) params.set("until", until);
  return apiGet<TopVideoResponse[]>(`/api/v1/analytics/videos/top?${params}`);
}

/** One video's all-time likes, comments and shares, from analytics-service's event store. */
export async function getVideoEngagement(videoId: string): Promise<VideoEngagementSummaryResponse> {
  if (USE_MOCK) {
    // Derived from the mock video rather than random, so the Likes figure and the engagement
    // rate on the same page agree with each other.
    const video = mockVideos.find((v) => v.id === videoId);
    const likes = video?.likeCount ?? 0;
    return { videoId, likes, comments: video?.commentCount ?? 0, shares: Math.round(likes / 20) };
  }
  return apiGet<VideoEngagementSummaryResponse>(`/api/v1/analytics/engagement/videos/${videoId}`);
}
