import "server-only";

import { apiGet, apiPost } from "./client";
import { USE_MOCK } from "./config";
import type {
  DailyCountResponse,
  DailyRevenueResponse,
  DailySignupResponse,
  ModerationActionResponse,
  ModerationActionType,
  Page,
  ReportResponse,
  ReportStatus,
  StatsSummaryResponse,
} from "./types";
import {
  toEngagementMix,
  toMosaicSeries,
  type EngagementMixRow,
  type MosaicSeries,
} from "./rollup";
import {
  mockDailyEngagement,
  mockDailyRevenue,
  mockDailySignups,
} from "@/lib/mock/analytics";
import { mockModerationActions, mockReports, mockStatsSummary } from "@/lib/mock/moderation";
import { MOCK_NOW } from "@/lib/mock/random";

/**
 * Single switch between mock and live for the whole console (see config.ts).
 * Signatures are identical either way, so pages never branch on it.
 */

export async function getStatsSummary(): Promise<StatsSummaryResponse> {
  if (USE_MOCK) return mockStatsSummary;
  return apiGet<StatsSummaryResponse>("/api/v1/admin/stats/summary");
}

export async function listReports(options: {
  status?: ReportStatus;
  size?: number;
} = {}): Promise<ReportResponse[]> {
  const { status, size = 50 } = options;

  if (USE_MOCK) {
    const filtered = status
      ? mockReports.filter((report) => report.status === status)
      : mockReports;
    return filtered.slice(0, size);
  }

  const params = new URLSearchParams({ size: String(size), sort: "createdAt,desc" });
  if (status) params.set("status", status);

  const page = await apiGet<Page<ReportResponse>>(`/api/v1/admin/reports?${params}`);
  return page.content;
}

export async function listModerationActions(size = 50): Promise<ModerationActionResponse[]> {
  if (USE_MOCK) return mockModerationActions.slice(0, size);

  const params = new URLSearchParams({ size: String(size), sort: "createdAt,desc" });
  const page = await apiGet<Page<ModerationActionResponse>>(`/api/v1/admin/actions?${params}`);
  return page.content;
}

export async function resolveReport(
  reportId: string,
  actionType: ModerationActionType,
  reason: string,
): Promise<ReportResponse> {
  if (USE_MOCK) {
    throw new Error("Resolving a report requires the live backend (ADMIN_USE_MOCK=false).");
  }
  return apiPost<ReportResponse>(`/api/v1/admin/reports/${reportId}/resolve`, {
    actionType,
    reason,
  });
}

export async function getDailyEngagement(days = 7): Promise<DailyCountResponse[]> {
  if (USE_MOCK) return mockDailyEngagement(days);
  return apiGet<DailyCountResponse[]>(`/api/v1/analytics/engagement/daily?days=${days}`);
}

/**
 * One 365-day pull rolled up into all three chart ranges, so the Daily/Weekly/Monthly
 * toggle is instant instead of a refetch per click.
 */
export async function getEngagementSeries(): Promise<MosaicSeries> {
  const rows = await getDailyEngagement(365);
  // Mock data is generated against a fixed clock; bucketing against Date.now() would miss it.
  return toMosaicSeries(rows, USE_MOCK ? MOCK_NOW : Date.now());
}

/**
 * The analytics page wants the same 365-day pull twice over — bucketed by day for the
 * mosaic, and totalled by event type for the mix. Derived together so it stays one
 * request rather than two identical ones.
 */
export async function getEngagementOverview(): Promise<{
  series: MosaicSeries;
  mix: EngagementMixRow[];
}> {
  const rows = await getDailyEngagement(365);
  return {
    series: toMosaicSeries(rows, USE_MOCK ? MOCK_NOW : Date.now()),
    mix: toEngagementMix(rows),
  };
}

export async function getDailyRevenue(days = 7): Promise<DailyRevenueResponse[]> {
  if (USE_MOCK) return mockDailyRevenue(days);
  return apiGet<DailyRevenueResponse[]>(`/api/v1/analytics/revenue/daily?days=${days}`);
}

export async function getDailySignups(days = 7): Promise<DailySignupResponse[]> {
  if (USE_MOCK) return mockDailySignups(days);
  return apiGet<DailySignupResponse[]>(`/api/v1/analytics/signups/daily?days=${days}`);
}
