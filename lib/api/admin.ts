import "server-only";

import { apiGet, apiPost } from "./client";
import { USE_MOCK } from "./config";
import type {
  AdminCommentResponse,
  AdminUserResponse,
  AdminVideoResponse,
  DailyCountResponse,
  DailySignupResponse,
  ModerationActionResponse,
  ModerationActionType,
  Page,
  ReportResponse,
  ReportStatus,
  StatsSummaryResponse,
  UserProfileResponse,
  UserStatus,
  VideoStatus,
} from "./types";
import {
  toEngagementMix,
  toMosaicSeries,
  type EngagementMixRow,
  type MosaicSeries,
} from "./rollup";
import {
  mockDailyEngagement,
  mockDailySignups,
} from "@/lib/mock/analytics";
import { mockModerationActions, mockReports, mockStatsSummary } from "@/lib/mock/moderation";
import { mockUsers } from "@/lib/mock/users";
import { mockComments } from "@/lib/mock/comments";
import { mockVideos } from "@/lib/mock/videos";
import { MOCK_NOW } from "@/lib/mock/random";

/**
 * Single switch between mock and live for the whole console (see config.ts).
 * Signatures are identical either way, so pages never branch on it.
 */

/**
 * The clock every dated page measures against. Mock fixtures are generated from a
 * frozen instant, so bucketing them against the real now would land every row outside
 * the window and draw an empty chart.
 */
export function referenceNow(): number {
  return USE_MOCK ? MOCK_NOW : Date.now();
}

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

/**
 * One target's moderation history — every takedown/restore/ban/unban recorded against it, newest
 * first. Same endpoint as {@link listModerationActions}, narrowed by target. The console loads it
 * lazily when a row is expanded, so the default page is small.
 */
export async function listTargetActions(
  targetType: "USER" | "VIDEO",
  targetId: string,
  size = 20,
): Promise<ModerationActionResponse[]> {
  if (USE_MOCK) {
    return mockModerationActions
      .filter((a) => a.targetType === targetType && a.targetId === targetId)
      .slice(0, size);
  }
  const params = new URLSearchParams({
    targetType,
    targetId,
    size: String(size),
    sort: "createdAt,desc",
  });
  const page = await apiGet<Page<ModerationActionResponse>>(`/api/v1/admin/actions?${params}`);
  return page.content;
}

/** How many reports have been filed against one user or video. */
export async function getReportCount(
  targetType: "USER" | "VIDEO",
  targetId: string,
): Promise<number> {
  if (USE_MOCK) {
    return mockReports.filter(
      (r) => r.targetType === targetType && r.targetId === targetId,
    ).length;
  }
  const params = new URLSearchParams({ targetType, targetId });
  return apiGet<number>(`/api/v1/admin/reports/count?${params}`);
}

/**
 * Handles (and avatar, follower count) for a batch of user ids, from user-service. Used to show a
 * video's owner as @handle rather than a bare id. Missing or blocked ids are simply absent from
 * the map — callers must tolerate a gap.
 */
export async function getUserProfiles(
  ids: string[],
): Promise<Record<string, UserProfileResponse>> {
  const unique = [...new Set(ids)].filter(Boolean);
  if (unique.length === 0) return {};
  if (USE_MOCK) {
    return Object.fromEntries(
      mockUsers
        .filter((u) => unique.includes(u.id))
        .map((u) => [
          u.id,
          {
            userId: u.id,
            username: u.username,
            displayName: null,
            avatarUrl: null,
            followerCount: 0,
            followingCount: 0,
          } satisfies UserProfileResponse,
        ]),
    );
  }
  const params = new URLSearchParams({ ids: unique.join(",") });
  const profiles = await apiGet<UserProfileResponse[]>(`/api/v1/users?${params}`);
  return Object.fromEntries(profiles.map((p) => [p.userId, p]));
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
export async function getEngagementSeries(asOfMs = referenceNow()): Promise<MosaicSeries> {
  const rows = await getDailyEngagement(365);
  return toMosaicSeries(rows, asOfMs);
}

/**
 * The analytics page wants the same 365-day pull twice over — bucketed by day for the
 * mosaic, and totalled by event type for the mix. Derived together so it stays one
 * request rather than two identical ones.
 */
export async function getEngagementOverview(asOfMs = referenceNow()): Promise<{
  series: MosaicSeries;
  mix: EngagementMixRow[];
}> {
  const rows = await getDailyEngagement(365);
  return {
    series: toMosaicSeries(rows, asOfMs),
    mix: toEngagementMix(rows),
  };
}

export async function getDailySignups(days = 7): Promise<DailySignupResponse[]> {
  if (USE_MOCK) return mockDailySignups(days);
  return apiGet<DailySignupResponse[]>(`/api/v1/analytics/signups/daily?days=${days}`);
}

/**
 * The directory is served by auth-service, under /api/v1/auth/** rather than /api/v1/admin/**:
 * that is the database holding status and role, and admin-service is not allowed to read it.
 * Filtering happens server-side so a banned-account search does not depend on how many rows
 * the page happened to fetch.
 */
export async function listUsers(options: {
  q?: string;
  status?: UserStatus;
  size?: number;
} = {}): Promise<AdminUserResponse[]> {
  const { q, status, size = 100 } = options;

  if (USE_MOCK) {
    const needle = q?.trim().toLowerCase();
    return mockUsers
      .filter((user) => {
        if (status && user.status !== status) return false;
        if (!needle) return true;
        return (
          user.username.toLowerCase().includes(needle) ||
          (user.email?.toLowerCase().includes(needle) ?? false)
        );
      })
      .slice(0, size);
  }

  const params = new URLSearchParams({ size: String(size) });
  if (q) params.set("q", q);
  if (status) params.set("status", status);

  const page = await apiGet<Page<AdminUserResponse>>(
    `/api/v1/auth/admin/users?${params}`,
  );
  return page.content;
}

/**
 * Ban and unban go through admin-service, not auth-service, even though auth-service is what
 * ends up changing the row: the call writes a moderation_actions record and an outbox event,
 * and auth-service applies it from the topic. Calling auth-service directly would flip the
 * status with nothing in the audit log.
 */
export async function moderateUser(
  userId: string,
  action: "ban" | "unban",
  reason: string,
): Promise<ModerationActionResponse> {
  if (USE_MOCK) {
    throw new Error(
      "Banning requires the live backend (ADMIN_USE_MOCK=false) — it writes an audit row and a Kafka event.",
    );
  }
  return apiPost<ModerationActionResponse>(
    `/api/v1/admin/users/${userId}/${action}`,
    { reason },
  );
}

/**
 * Served by video-service under /api/v1/videos/admin, not by admin-service: that is the store
 * owning status and visibility, and no service may read another's database. Every other GET on
 * /api/v1/videos is public, so this one path is pinned to ROLE_ADMIN in video-service's
 * SecurityConfig — it lists every owner's uploads, including the ones moderation removed.
 *
 * Filtering is server-side for the same reason as the user directory: "show me everything taken
 * down" must not depend on how many rows this page happened to fetch.
 */
export async function listVideos(options: {
  q?: string;
  status?: VideoStatus;
  size?: number;
} = {}): Promise<AdminVideoResponse[]> {
  const { q, status, size = 100 } = options;

  if (USE_MOCK) {
    const needle = q?.trim().toLowerCase();
    return mockVideos
      .filter((video) => {
        if (status && video.status !== status) return false;
        return !needle || video.title.toLowerCase().includes(needle);
      })
      .slice(0, size);
  }

  const params = new URLSearchParams({ size: String(size) });
  if (q) params.set("q", q);
  if (status) params.set("status", status);

  const page = await apiGet<Page<AdminVideoResponse>>(`/api/v1/videos/admin?${params}`);
  return page.content;
}

/**
 * Takedown and restore go through admin-service even though video-service is what changes the
 * document: the call writes a moderation_actions row plus an outbox event, and video-service
 * applies it from admin.moderation-events. Calling video-service directly would change the
 * status with nothing in the audit log to say who did it or why.
 */
export async function moderateVideo(
  videoId: string,
  action: "takedown" | "restore",
  reason: string,
): Promise<ModerationActionResponse> {
  if (USE_MOCK) {
    throw new Error(
      "Takedown requires the live backend (ADMIN_USE_MOCK=false) — it writes an audit row and a Kafka event.",
    );
  }
  return apiPost<ModerationActionResponse>(
    `/api/v1/admin/videos/${videoId}/${action}`,
    { reason },
  );
}

/**
 * One video's thread, removed comments included. Per video because that is the only shape
 * Cassandra can answer: comments_by_video is partitioned by video id, and a platform-wide "newest
 * comments" listing would need a second table written on every comment.
 */
export async function listComments(
  videoId: string,
  size = 50,
): Promise<AdminCommentResponse[]> {
  if (USE_MOCK) return mockComments(videoId, size);
  return apiGet<AdminCommentResponse[]>(
    `/api/v1/interactions/admin/videos/${videoId}/comments?size=${size}`,
  );
}

/**
 * Removal goes through admin-service even though interaction-service owns the row: the call
 * writes a moderation_actions row plus an outbox event, and interaction-service applies it from
 * admin.moderation-events. Calling interaction-service directly would delete the comment with
 * nothing in the audit log to say who did it or why.
 *
 * There is no restore counterpart. The soft delete is undone only by interaction-service's own
 * compensation, which is conditioned on the exact deletion it wrote — an unconditional un-delete
 * would resurrect comments other people removed.
 */
export async function removeComment(
  videoId: string,
  commentId: string,
  reason: string,
): Promise<ModerationActionResponse> {
  if (USE_MOCK) {
    throw new Error(
      "Removing a comment requires the live backend (ADMIN_USE_MOCK=false) — it writes an audit row and a Kafka event.",
    );
  }
  return apiPost<ModerationActionResponse>(
    `/api/v1/admin/comments/${videoId}/${commentId}/remove`,
    { reason },
  );
}
