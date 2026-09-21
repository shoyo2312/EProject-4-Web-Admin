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
  DailyCountResponse,
  DailySignupResponse,
  ModerationSettingsResponse,
  TopVideoResponse,
  ModerationActionResponse,
  ModerationActionType,
  Page,
  ReportGroupResponse,
  ReportResponse,
  ReportStatus,
  ReportTargetType,
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
import type { ReportSortField } from "@/lib/moderation";
import {
  mockDailyEngagement,
  mockDailyActiveUsers,
  mockDailySignups,
  mockTopVideos,
} from "@/lib/mock/analytics";
import {
  mockModerationActions,
  mockReportQueue,
  mockReports,
  mockStatsSummary,
} from "@/lib/mock/moderation";
import { mockUsers } from "@/lib/mock/users";
import { mockCommentPage, mockCommentsByIds, mockReplyPage } from "@/lib/mock/comments";
import { mockVideos } from "@/lib/mock/videos";
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
export async function listReports(options: {
  status?: ReportStatus;
  targetType?: ReportTargetType;
  sort?: ReportSortField;
  ascending?: boolean;
  page?: number;
  size?: number;
} = {}): Promise<Page<ReportResponse>> {
  const {
    status,
    targetType,
    sort = "createdAt",
    ascending = false,
    page = 0,
    size = LIST_PAGE_SIZE,
  } = options;

  if (USE_MOCK) {
    const filtered = mockReports.filter(
      (report) =>
        (!status || report.status === status)
        && (!targetType || report.targetType === targetType),
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
): Promise<ModerationActionResponse> {
  if (USE_MOCK) {
    throw new Error("Resolving a report requires the live backend (ADMIN_USE_MOCK=false).");
  }
  return apiPost<ModerationActionResponse>("/api/v1/admin/reports/queue/resolve", {
    targetType,
    targetId,
    actionType,
    reason,
  });
}

export async function listModerationActions(options: {
  page?: number;
  size?: number;
} = {}): Promise<Page<ModerationActionResponse>> {
  const { page = 0, size = LIST_PAGE_SIZE } = options;
  if (USE_MOCK) return mockPage(mockModerationActions, page, size);

  const params = new URLSearchParams({
    page: String(page),
    size: String(size),
    sort: "createdAt,desc",
  });
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
 * Two calls, because auth-service's directory has no by-id route and its `q` matches the handle
 * and the email only: the handle comes from user-service first and is then used as the search
 * term. The row is picked out by id rather than by handle, since `like '%…%'` matches every
 * account whose handle merely contains that string.
 *
 * Null when the account cannot be reached this way — nothing at that id, or no user-service
 * profile to take a handle from. The caller shows "not found" rather than the wrong account.
 *
 * ponytail: `OR CAST(u.id AS string) LIKE :term` in auth-service's `searchForAdmin` collapses
 * this to one call and makes pasting an id into the console's own search box work. Worth doing
 * the first time a profile-less account has to be opened — those are what this returns null for.
 */
export async function getAdminUser(userId: string): Promise<AdminUserResponse | null> {
  if (USE_MOCK) return mockUsers.find((user) => user.id === userId) ?? null;

  const handle = (await getUserProfiles([userId]))[userId]?.username;
  if (!handle) return null;

  // Wider than a page: the term is a substring match, so a short handle can pull in every
  // account that contains it and push the exact one past row twenty-five.
  const page = await listUsers({ q: handle, size: 100 });
  return page.content.find((user) => user.id === userId) ?? null;
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
  /** Days until the ban lapses, or null for one that does not. Ignored on an unban. */
  banDays: number | null = null,
): Promise<ModerationActionResponse> {
  if (USE_MOCK) {
    throw new Error(
      "Banning requires the live backend (ADMIN_USE_MOCK=false) — it writes an audit row and a Kafka event.",
    );
  }
  return apiPost<ModerationActionResponse>(
    `/api/v1/admin/users/${userId}/${action}`,
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
  page?: number;
  size?: number;
} = {}): Promise<Page<AdminVideoResponse>> {
  const { q, status, ownerIds, page = 0, size = LIST_PAGE_SIZE } = options;

  if (USE_MOCK) {
    const needle = q?.trim().toLowerCase();
    const owners = new Set(ownerIds);
    const filtered = mockVideos.filter((video) => {
      if (status && video.status !== status) return false;
      if (!needle && owners.size === 0) return true;
      return (
        (!!needle && video.title.toLowerCase().includes(needle)) || owners.has(video.userId)
      );
    });
    return mockPage(filtered, page, size);
  }

  const params = new URLSearchParams({ page: String(page), size: String(size) });
  if (q) params.set("q", q);
  if (status) params.set("status", status);
  for (const ownerId of ownerIds ?? []) params.append("ownerId", ownerId);

  return apiGet<Page<AdminVideoResponse>>(`/api/v1/videos/admin?${params}`);
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
