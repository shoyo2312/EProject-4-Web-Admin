import "server-only";

import { ApiError, apiGet, apiPost } from "./client";
import { USE_MOCK } from "./config";
import type {
  AdminCommentFilter,
  AdminCommentPage,
  AdminCommentResponse,
  AdminUserResponse,
  AdminVideoResponse,
  DailyActiveUsersResponse,
  DailyAdminStatsResponse,
  DailyCountResponse,
  DailySignupResponse,
  DailyVideoStatsResponse,
  ModerationSettingsResponse,
  TopVideoResponse,
  ModerationActionResponse,
  ModerationActionType,
  Page,
  ReportGroupResponse,
  ReportResponse,
  SecurityEventResponse,
  ReportStatus,
  ReportTargetType,
  StatsSummaryResponse,
  UserProfileResponse,
  UserStatus,
  VideoEngagementSummaryResponse,
  VideoStatus,
} from "./types";
import {
  toEngagementMix,
  toMosaicSeries,
  type EngagementMixRow,
  type MosaicSeries,
} from "./rollup";
import type { ReportSortField } from "@/lib/moderation";
import { memoizeFor } from "@/lib/memo";
import type { RowNames, VideoSummary } from "@/lib/names";
import { buildNotifications, type AdminNotification } from "@/lib/notifications";
import {
  mockDailyEngagement,
  mockDailyActiveUsers,
  mockDailySignups,
  mockTopVideos,
} from "@/lib/mock/analytics";
import {
  MOCK_REPORTER_HANDLES,
  mockDailyAdminStats,
  mockModerationActions,
  mockReportQueue,
  mockReports,
  mockStatsSummary,
} from "@/lib/mock/moderation";
import { mockUsers } from "@/lib/mock/users";
import { mockSecurityEvents } from "@/lib/mock/security-events";
import { mockCommentPage, mockCommentsByIds, mockReplyPage } from "@/lib/mock/comments";
import { mockDailyVideoStats, mockVideos } from "@/lib/mock/videos";
import { MOCK_NOW } from "@/lib/mock/random";

/**
 * Single switch between mock and live for the whole console (see config.ts).
 * Signatures are identical either way, so pages never branch on it.
 */

/**
 * How many comments one page holds, and how many replies one "View replies" click pulls down.
 * The reply page is small on purpose — the same three-at-a-time reveal the viewer-facing panel
 * uses, so opening a thread of two hundred does not land two hundred rows in the console.
 */
export const COMMENT_PAGE_SIZE = 20;
export const REPLY_PAGE_SIZE = 3;

/**
 * Rows per page in the directories and the moderation lists. Matches the `@PageableDefault`
 * the four endpoints declare, so an unparameterised request and a page-0 request agree.
 */
export const LIST_PAGE_SIZE = 25;

/**
 * A mock slice shaped like the Spring page the live path returns, so a page reads the same
 * fields either way and never branches on USE_MOCK.
 */
function mockPage<T>(rows: T[], page: number, size: number): Page<T> {
  return {
    content: rows.slice(page * size, page * size + size),
    totalElements: rows.length,
    totalPages: Math.max(1, Math.ceil(rows.length / size)),
    number: page,
    size,
  };
}

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

/**
 * Applies a `field,dir` ordering to the mock fixtures, so a page reads the same either way.
 * Ids are numeric strings of differing length and compare as numbers — `localeCompare` would
 * put "9" after "10".
 */
function sortReports(
  rows: ReportResponse[],
  field: ReportSortField,
  ascending: boolean,
): ReportResponse[] {
  const sign = ascending ? 1 : -1;
  return [...rows].sort((a, b) =>
    field === "id"
      ? (Number(a.id) - Number(b.id)) * sign
      : a[field].localeCompare(b[field]) * sign,
  );
}

/**
 * The report ledger: every report ever filed, narrowed and ordered by the server.
 *
 * Every control goes to the backend rather than being applied to the rows that come back. The
 * listing is paged, so a status filter applied here would mean "the dismissed ones among these
 * twenty-five" while reading as a platform total — and a sort applied here can only reorder the
 * rows that already won.
 */
/**
 * The report ledger. `targetId` and `reporterId` are the two halves an account's activity
 * history needs — what was filed against it, and what it filed against others — and both are
 * filtered server-side: narrowing a fetched page client-side would show whichever of the
 * account's reports happened to land on page 0 and call it the whole history.
 */
export async function listReports(options: {
  status?: ReportStatus;
  targetType?: ReportTargetType;
  targetId?: string;
  reporterId?: string;
  sort?: ReportSortField;
  ascending?: boolean;
  page?: number;
  size?: number;
} = {}): Promise<Page<ReportResponse>> {
  const {
    status,
    targetType,
    targetId,
    reporterId,
    sort = "createdAt",
    ascending = false,
    page = 0,
    size = LIST_PAGE_SIZE,
  } = options;

  if (USE_MOCK) {
    const filtered = mockReports.filter(
      (report) =>
        (!status || report.status === status)
        && (!targetType || report.targetType === targetType)
        && (!targetId || report.targetId === targetId)
        && (!reporterId || report.reporterId === reporterId),
    );
    return mockPage(sortReports(filtered, sort, ascending), page, size);
  }

  const params = new URLSearchParams({
    page: String(page),
    size: String(size),
    sort: `${sort},${ascending ? "asc" : "desc"}`,
  });
  if (status) params.set("status", status);
  if (targetType) params.set("targetType", targetType);
  if (targetId) params.set("targetId", targetId);
  if (reporterId) params.set("reporterId", reporterId);

  return apiGet<Page<ReportResponse>>(`/api/v1/admin/reports?${params}`);
}

/**
 * The worklist: one row per reported target, heaviest first. Separate endpoint from
 * {@link listReports}, which is the report ledger — fifty people flagging one video is fifty
 * rows there and one row here, and one row here is one decision.
 *
 * No sort parameter: the ordering (`reportCount × severity`, longest wait breaking ties) is the
 * queue's reason for existing and is computed across the whole table, not the page. A client-side
 * sort could only reorder the twenty-five rows that already won.
 */
export async function listReportQueue(options: {
  page?: number;
  size?: number;
} = {}): Promise<Page<ReportGroupResponse>> {
  const { page = 0, size = LIST_PAGE_SIZE } = options;
  if (USE_MOCK) return mockPage(mockReportQueue, page, size);

  const params = new URLSearchParams({ page: String(page), size: String(size) });
  return apiGet<Page<ReportGroupResponse>>(`/api/v1/admin/reports/queue?${params}`);
}

/**
 * Decides one queue row: writes the audit action, publishes the enforcement event, and closes
 * every report standing against that target in the same transaction.
 *
 * Addressed by target rather than by report id — naming one of forty reports to carry the
 * decision would put an arbitrary row in the audit log as though it were the reason.
 */
export async function resolveQueueRow(
  targetType: ReportTargetType,
  targetId: string,
  actionType: ModerationActionType,
  reason: string,
  /** Days until a BAN_USER lapses, or null for one that does not. Ignored for other actions. */
  banDays: number | null = null,
): Promise<ModerationActionResponse> {
  if (USE_MOCK) {
    throw new Error("Resolving a report requires the live backend (ADMIN_USE_MOCK=false).");
  }
  return apiPost<ModerationActionResponse>("/api/v1/admin/reports/queue/resolve", {
    targetType,
    targetId,
    actionType,
    reason,
    banDays,
  });
}

/** The audit log, newest first. Every filter is optional; `from` is inclusive, `to` exclusive. */
export async function listModerationActions(options: {
  page?: number;
  size?: number;
  adminId?: string;
  actionType?: ModerationActionType;
  /** ISO instants. */
  from?: string;
  to?: string;
} = {}): Promise<Page<ModerationActionResponse>> {
  const { page = 0, size = LIST_PAGE_SIZE, adminId, actionType, from, to } = options;
  if (USE_MOCK) {
    const matches = mockModerationActions.filter(
      (a) =>
        (!adminId || a.adminId === adminId)
        && (!actionType || a.actionType === actionType)
        && (!from || Date.parse(a.createdAt) >= Date.parse(from))
        && (!to || Date.parse(a.createdAt) < Date.parse(to)),
    );
    return mockPage(matches, page, size);
  }

  const params = new URLSearchParams({
    page: String(page),
    size: String(size),
    sort: "createdAt,desc",
  });
  if (adminId) params.set("adminId", adminId);
  if (actionType) params.set("actionType", actionType);
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  return apiGet<Page<ModerationActionResponse>>(`/api/v1/admin/actions?${params}`);
}

/**
 * One target's moderation history — every takedown/restore/ban/unban recorded against it, newest
 * first. Same endpoint as {@link listModerationActions}, narrowed by target. The console loads it
 * lazily when a row is expanded, so the default page is small.
 */
export async function listTargetActions(
  targetType: ReportTargetType,
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

/**
 * One report by id — what a moderator pastes when someone asks about report #…4821. Null for an
 * id nothing was filed under (404) and for one that is not a number at all (400): a mistyped id
 * is "not found", not a failure.
 */
export async function getReport(reportId: string): Promise<ReportResponse | null> {
  if (USE_MOCK) return mockReports.find((report) => report.id === reportId) ?? null;
  try {
    return await apiGet<ReportResponse>(`/api/v1/admin/reports/${encodeURIComponent(reportId)}`);
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) return null;
    throw error;
  }
}

/** How many reports have been filed against one user, video or comment. */
export async function getReportCount(
  targetType: ReportTargetType,
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
    // The mock reporters are not in the mock directory, so their handles come from the ledger's
    // own fixture — the same handles the live path would get back for them.
    const handles = new Map<string, string>(Object.entries(MOCK_REPORTER_HANDLES));
    for (const user of mockUsers) handles.set(user.id, user.username);
    return Object.fromEntries(
      unique
        .filter((id) => handles.has(id))
        .map((id) => [
          id,
          {
            userId: id,
            username: handles.get(id) ?? null,
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

/**
 * @handles for a batch of user ids — the admins on a page of the audit log, the reporters on a
 * page of the ledger, the accounts reports point at. One call for the page rather than one per
 * row. An id user-service does not know, or a user-service that cannot be reached, is simply
 * absent: the row keeps showing the id, which is what it showed before.
 */
export async function getHandles(ids: string[]): Promise<Record<string, string>> {
  const profiles = await getUserProfiles(ids).catch(
    (): Record<string, UserProfileResponse> => ({}),
  );
  const handles: Record<string, string> = {};
  for (const [id, profile] of Object.entries(profiles)) {
    if (profile.username) handles[id] = `@${profile.username}`;
  }
  return handles;
}

/**
 * Titles and poster frames for a batch of video ids, to name the rows of a list that otherwise
 * carry a bare id — the report queue, the audit log, the most-watched table.
 *
 * Best effort, by construction. The public batch route is the only one that takes a list of ids,
 * and it applies the viewer visibility rule: a video that is taken down, private, still
 * processing or deleted comes back absent, and its row keeps showing the id. The alternative —
 * the admin route, one call per row — would spend the gateway's per-address rate limit, which
 * every server-side call this console makes shares, on labels. A video's own page still reads it
 * through the admin route, with no rule applied.
 */
export async function getVideoSummaries(ids: string[]): Promise<Record<string, VideoSummary>> {
  const unique = [...new Set(ids)].filter(Boolean);
  if (unique.length === 0) return {};
  const summarise = (video: Pick<AdminVideoResponse, "title" | "thumbnailUrl" | "userId">) => ({
    title: video.title,
    thumbnailUrl: video.thumbnailUrl,
    userId: video.userId,
  });
  if (USE_MOCK) {
    return Object.fromEntries(
      mockVideos
        .filter((v) => unique.includes(v.id) && v.status === "PUBLISHED" && !v.deletedAt)
        .map((v) => [v.id, summarise(v)]),
    );
  }
  const params = new URLSearchParams({ ids: unique.join(",") });
  const videos = await apiGet<AdminVideoResponse[]>(`/api/v1/videos/batch?${params}`).catch(
    (): AdminVideoResponse[] => [],
  );
  return Object.fromEntries(videos.map((video) => [video.id, summarise(video)]));
}

/**
 * @handles for admins — the people the audit log and every moderation history name.
 *
 * From auth-service's directory, one call per admin, rather than {@link getHandles}' batch: the
 * bootstrap admin is created straight in auth-service and never gets a user-service profile, so
 * the batch cannot name the account that takes most of the actions. A page names a handful of
 * admins; the cap keeps a page of unknown ids from spending the gateway's rate limit.
 */
export async function getAdminHandles(adminIds: (string | null)[]): Promise<Record<string, string>> {
  const unique = [...new Set(adminIds)].filter((id): id is string => Boolean(id)).slice(0, 10);
  const accounts = await Promise.all(unique.map((id) => getAdminUser(id).catch(() => null)));
  return Object.fromEntries(
    accounts
      .filter((account): account is AdminUserResponse => account !== null)
      .map((account) => [account.id, `@${account.username}`]),
  );
}

/**
 * Everything one page of a moderation list needs to name its rows: accounts through
 * {@link getHandles}, admins through {@link getAdminHandles}, videos through
 * {@link getVideoSummaries}. Three lookups side by side, whatever the page size.
 */
export async function getRowNames(
  userIds: string[],
  videoIds: string[],
  adminIds: (string | null)[] = [],
): Promise<RowNames> {
  const [users, admins, videos] = await Promise.all([
    getHandles(userIds),
    getAdminHandles(adminIds),
    getVideoSummaries(videoIds),
  ]);
  return { handles: { ...users, ...admins }, videos };
}

/**
 * One video by id, for the reports queue: a report carries a bare video id and the admin listing
 * can only be searched by title, so there is no other way back to what was reported.
 *
 * The admin route rather than the public one, which applies the viewer visibility rule and so
 * hides exactly the videos moderation cares about — taken down, private, still processing, or
 * deleted by their owner after the report came in. A 404 here means the id resolves to nothing at
 * all; the caller shows the report without a preview rather than failing the row.
 */
export async function getVideo(videoId: string): Promise<AdminVideoResponse | null> {
  if (USE_MOCK) return mockVideos.find((video) => video.id === videoId) ?? null;
  try {
    return await apiGet<AdminVideoResponse>(`/api/v1/videos/admin/${videoId}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

export async function resolveReport(
  reportId: string,
  actionType: ModerationActionType,
  reason: string,
  /** Days until a BAN_USER lapses, or null for one that does not. Ignored for other actions. */
  banDays: number | null = null,
): Promise<ReportResponse> {
  if (USE_MOCK) {
    throw new Error("Resolving a report requires the live backend (ADMIN_USE_MOCK=false).");
  }
  return apiPost<ReportResponse>(`/api/v1/admin/reports/${reportId}/resolve`, {
    actionType,
    reason,
    banDays,
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
 * Distinct viewers per day, from watch events.
 *
 * Not derivable from anything the console already pulls: engagement counts actions, and the
 * people who watch without liking anything — most of them — appear in none of them.
 */
export async function getDailyActiveUsers(days = 7): Promise<DailyActiveUsersResponse[]> {
  if (USE_MOCK) return mockDailyActiveUsers(days);
  return apiGet<DailyActiveUsersResponse[]>(`/api/v1/analytics/active-users/daily?days=${days}`);
}

/** The most-watched videos of the window, ordered by time spent rather than by view count. */
export async function getTopVideos(days = 7, limit = 20): Promise<TopVideoResponse[]> {
  if (USE_MOCK) return mockTopVideos(limit);
  return apiGet<TopVideoResponse[]>(`/api/v1/analytics/videos/top?days=${days}&limit=${limit}`);
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

/**
 * What automatic moderation is deciding with. admin-service reads it from moderation-service,
 * which is internal-only, and answers `reachable: false` rather than failing if it cannot.
 */
export async function getModerationSettings(): Promise<ModerationSettingsResponse> {
  if (USE_MOCK) {
    return {
      reachable: true,
      values: {
        model: "Falconsai/nsfw_image_detection",
        modelVersion: "nsfw-v1",
        nsfwLabel: "nsfw",
        maxFrames: 32,
        reviewAt: 0.6,
        rejectAt: 0.9,
        minRejectFrames: 2,
        escalationEnabled: false,
        escalationFrames: 3,
        escalationCategories: ["Sexual", "Violence", "SelfHarm", "Hate"],
        escalationRejectSeverity: 4,
        escalationApproveSeverity: 0,
      },
    };
  }
  return apiGet<ModerationSettingsResponse>("/api/v1/admin/settings/moderation");
}

/**
 * How many times this target has been banned, taken down or had a comment removed.
 *
 * Counts enforcement only, and a reversal does not subtract — see admin-service's
 * `countStrikes`. Zero is a clean record; it is not "no data".
 */
export async function getStrikeCount(
  targetType: ReportTargetType,
  targetId: string,
): Promise<number> {
  if (USE_MOCK) return 0;
  const params = new URLSearchParams({ targetType, targetId });
  return apiGet<number>(`/api/v1/admin/actions/strikes?${params}`);
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
  page?: number;
  size?: number;
} = {}): Promise<Page<AdminUserResponse>> {
  const { q, status, page = 0, size = LIST_PAGE_SIZE } = options;

  if (USE_MOCK) {
    const needle = q?.trim().toLowerCase();
    const filtered = mockUsers.filter((user) => {
      if (status && user.status !== status) return false;
      if (!needle) return true;
      return (
        user.username.toLowerCase().includes(needle) ||
        (user.email?.toLowerCase().includes(needle) ?? false)
      );
    });
    return mockPage(filtered, page, size);
  }

  const params = new URLSearchParams({ page: String(page), size: String(size) });
  if (q) params.set("q", q);
  if (status) params.set("status", status);

  return apiGet<Page<AdminUserResponse>>(`/api/v1/auth/admin/users?${params}`);
}

/**
 * One account by id — what a report resolves to, since a report carries the reported user's id
 * and nothing else.
 *
 * Null when nothing is registered at that id or the account was deleted (404), and for an id
 * that is not a number at all (400) — a hand-edited URL is "not found", not a failure.
 */
export async function getAdminUser(userId: string): Promise<AdminUserResponse | null> {
  if (USE_MOCK) return mockUsers.find((user) => user.id === userId) ?? null;
  try {
    return await apiGet<AdminUserResponse>(`/api/v1/auth/admin/users/${userId}`);
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) return null;
    throw error;
  }
}

/**
 * One account's security log — sign-ins, failed attempts, password resets, address changes, the
 * admin second factor. auth-service, like the directory above: that is the database that records
 * them, and admin-service is not allowed to read it.
 *
 * Newest first, and no filter parameter: the console merges this into one timeline and narrows
 * there, so a second filter here would be a second thing to keep in step with the first.
 */
export async function listSecurityEvents(
  userId: string,
  size = LIST_PAGE_SIZE,
): Promise<Page<SecurityEventResponse>> {
  if (USE_MOCK) return mockPage(mockSecurityEvents[userId] ?? [], 0, size);

  const params = new URLSearchParams({ page: "0", size: String(size) });
  return apiGet<Page<SecurityEventResponse>>(
    `/api/v1/auth/admin/users/${userId}/security-events?${params}`,
  );
}

/**
 * Ban, unban, warn and sign-out all go through admin-service, not auth-service, even though
 * auth-service is what ends up changing the account: the call writes a moderation_actions record
 * and an outbox event, and auth-service (or notification-service, for a warning) applies it from
 * the topic. Calling auth-service directly would act with nothing in the audit log.
 */
export async function moderateUser(
  userId: string,
  action: "ban" | "unban" | "warn" | "revokeSessions",
  reason: string,
  /** Days until the ban lapses, or null for one that does not. Ignored by everything but a ban. */
  banDays: number | null = null,
): Promise<ModerationActionResponse> {
  if (USE_MOCK) {
    throw new Error(
      "Account actions require the live backend (ADMIN_USE_MOCK=false) — each writes an audit row and a Kafka event.",
    );
  }
  const path = action === "revokeSessions" ? "revoke-sessions" : action;
  return apiPost<ModerationActionResponse>(
    `/api/v1/admin/users/${userId}/${path}`,
    { reason, banDays },
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
  /**
   * Owners whose uploads match too, on top of whatever `q` matches by title. video-service
   * stores the owner's id and user-service owns their handle, so a search for a handle has to
   * be resolved to ids before it gets here — see `resolveOwners`.
   */
  ownerIds?: string[];
  /**
   * Undefined for no filter on it (both live and deleted rows match, the default); true for
   * deleted rows only; false for live rows only.
   */
  deleted?: boolean;
  /** Same three states, on whether the media is already erased. The trash is deleted && !purged. */
  purged?: boolean;
  /** Unset is newest upload first. The trash reads soonest-to-expire first. */
  sort?: "deletedAt,asc";
  page?: number;
  size?: number;
} = {}): Promise<Page<AdminVideoResponse>> {
  const { q, status, ownerIds, deleted, purged, sort, page = 0, size = LIST_PAGE_SIZE } = options;

  if (USE_MOCK) {
    const needle = q?.trim().toLowerCase();
    const owners = new Set(ownerIds);
    const filtered = mockVideos.filter((video) => {
      if (status && video.status !== status) return false;
      if (deleted != null && Boolean(video.deletedAt) !== deleted) return false;
      if (purged != null && Boolean(video.purgeEventPublishedAt) !== purged) return false;
      if (!needle && owners.size === 0) return true;
      return (
        (!!needle && video.title.toLowerCase().includes(needle)) || owners.has(video.userId)
      );
    });
    if (sort) filtered.sort((a, b) => (a.deletedAt ?? "").localeCompare(b.deletedAt ?? ""));
    return mockPage(filtered, page, size);
  }

  const params = new URLSearchParams({ page: String(page), size: String(size) });
  if (q) params.set("q", q);
  if (status) params.set("status", status);
  if (deleted != null) params.set("deleted", String(deleted));
  if (purged != null) params.set("purged", String(purged));
  if (sort) params.set("sort", sort);
  for (const ownerId of ownerIds ?? []) params.append("ownerId", ownerId);

  return apiGet<Page<AdminVideoResponse>>(`/api/v1/videos/admin?${params}`);
}

const NOTIFICATIONS_TTL_MS = 30_000;

/**
 * The bell's feed. Only the first page of each source — the bell is a nudge that links to the
 * full listing, not a second copy of it. The trash reads soonest-to-expire first, so its first
 * page holds every video close enough to the purge to mention. Sign-ups and uploads are counted
 * rather than listed, so they read a longer page, newest first; past 50 in a day the bell says 50+.
 *
 * Kept for {@link NOTIFICATIONS_TTL_MS} and shared by every admin. The layout renders it, and the
 * live stream re-renders the layout up to once a second during a burst of events — five gateway
 * calls each time, two of them 50-row pages. Nothing in the feed is per-admin (unread is, and
 * that is a cookie), so one copy serves them all; the cost is a bell up to that long behind.
 */
export const getNotifications = memoizeFor(NOTIFICATIONS_TTL_MS, loadNotifications);

async function loadNotifications(): Promise<AdminNotification[]> {
  const size = 10;
  const [queue, review, trash, signups, uploads] = await Promise.all([
    listReportQueue({ size }),
    listVideos({ status: "PENDING_REVIEW", deleted: false, size }),
    listVideos({ deleted: true, purged: false, sort: "deletedAt,asc", size }),
    listUsers({ size: 50 }),
    listVideos({ deleted: false, size: 50 }),
  ]);
  return buildNotifications({
    queue: queue.content,
    review: review.content,
    trash: trash.content,
    signups,
    uploads,
    now: referenceNow(),
  });
}

/**
 * The accounts a search term names, as ids the video listing can filter on.
 *
 * Typing a handle into the video search and getting nothing back is the whole reason this
 * exists: video documents carry `userId` and no handle, so the match has to happen in
 * auth-service's directory first. Capped because this widens a search — a term like "gmail"
 * matches every account with it in their email, and a thousand-id query is not a search.
 *
 * Non-fatal: if the directory cannot be reached the video search still runs on titles.
 */
export async function resolveOwners(q: string, limit = 25): Promise<string[]> {
  const term = q.trim();
  if (!term) return [];
  const page = await listUsers({ q: term, size: limit }).catch(() => null);
  return page?.content.map((user) => user.id) ?? [];
}

/**
 * Takedown and restore go through admin-service even though video-service is what changes the
 * document: the call writes a moderation_actions row plus an outbox event, and video-service
 * applies it from admin.moderation-events. Calling video-service directly would change the
 * status with nothing in the audit log to say who did it or why.
 */
export async function moderateVideo(
  videoId: string,
  action: "takedown" | "restore" | "purge",
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
 * One page of a video's comments, removed ones included. Per video because that is the only shape
 * Cassandra can answer: both tables behind it are partitioned by video id, and a platform-wide
 * "newest comments" listing would need another table written on every comment.
 *
 * Cursor-paged rather than one slab: before this, a thread longer than the page was silently
 * truncated, and an admin had no way to tell. The cursor is opaque — pass back what the last page
 * returned.
 */
export async function listComments(
  videoId: string,
  options: { filter?: AdminCommentFilter; cursor?: string | null; size?: number } = {},
): Promise<AdminCommentPage> {
  const { filter = "THREAD", cursor, size = COMMENT_PAGE_SIZE } = options;
  if (USE_MOCK) return mockCommentPage(videoId, filter, cursor ?? null, size);

  const params = new URLSearchParams({ filter, size: String(size) });
  if (cursor) params.set("cursor", cursor);
  return apiGet<AdminCommentPage>(
    `/api/v1/interactions/admin/videos/${videoId}/comments?${params}`,
  );
}

/**
 * One comment's replies, oldest first. Split from the listing above, which returns top-level
 * comments only: a thread of two hundred replies is not something every page of comments should
 * carry, and an admin opens one thread at a time.
 */
export async function listCommentReplies(
  videoId: string,
  commentId: string,
  cursor: string | null = null,
  size = REPLY_PAGE_SIZE,
): Promise<AdminCommentPage> {
  if (USE_MOCK) return mockReplyPage(videoId, commentId, cursor, size);

  const params = new URLSearchParams({ size: String(size) });
  if (cursor) params.set("cursor", cursor);
  return apiGet<AdminCommentPage>(
    `/api/v1/interactions/admin/videos/${videoId}/comments/${commentId}/replies?${params}`,
  );
}

/**
 * Specific comments by id. Used for the comment a reply answers: the Replies and Removed views are
 * flat, so the parent is usually not on the page beside its reply. Ids that resolve to nothing are
 * simply absent from the result — the caller renders the reply without a preview.
 */
export async function getComments(
  videoId: string,
  ids: string[],
): Promise<AdminCommentResponse[]> {
  const unique = [...new Set(ids)].filter(Boolean);
  if (unique.length === 0) return [];
  if (USE_MOCK) return mockCommentsByIds(videoId, unique);

  const params = new URLSearchParams({ ids: unique.join(",") });
  return apiGet<AdminCommentResponse[]>(
    `/api/v1/interactions/admin/videos/${videoId}/comments/by-ids?${params}`,
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
