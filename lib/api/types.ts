/**
 * Mirrors the real backend response records 1-1. When the mock layer is swapped for
 * fetch() against the gateway, nothing in the components has to change.
 *
 * Sources:
 *   admin-service      com.tiktok.adminservice.dto.response.*
 *   analytics-service  com.tiktok.analyticsservice.dto.response.*
 *
 * Note on ids: the backend uses Snowflake `Long` ids, which exceed Number.MAX_SAFE_INTEGER.
 * They are typed as `string` here — JSON.parse would silently corrupt them as numbers.
 */

/** admin-service — entity/ReportStatus.java */
export type ReportStatus = "PENDING" | "RESOLVED" | "DISMISSED";

/**
 * Which slice of a video's comments to read — interaction-service's AdminCommentFilter.
 *
 * Server-side rather than a filter over what the page holds: the listing is cursor-paged, so
 * "removed" applied to the rows on screen would mean "removed among the twenty loaded", which
 * reads as "removed in this thread" and is not.
 */
export type AdminCommentFilter = "THREAD" | "REPLIES" | "REMOVED";

/**
 * GET /api/v1/interactions/admin/videos/{videoId}/comments — served by interaction-service.
 *
 * Ids are Snowflake longs, so strings. Unlike the public CommentResponse this carries deletedAt:
 * the console has to show what has already been removed, or a comment somebody took down looks
 * identical to one that was never posted.
 */
export interface AdminCommentResponse {
  commentId: string;
  videoId: string;
  userId: string;
  content: string;
  /** Null for a top-level comment; the top-level comment's id for a reply. */
  parentId: string | null;
  /** Set only when this reply targets another reply, so the list can show "A > B". */
  replyToUserId: string | null;
  likeCount: number;
  /**
   * Replies still standing under this comment; 0 on a reply, which cannot have any. Live only —
   * comment_counters is decremented when a reply is removed, so read hasReplies, not this, to
   * decide whether there is anything to open.
   */
  replyCount: number;
  /** Whether anything hangs under this comment at all, removed replies included. */
  hasReplies: boolean;
  createdAt: string;
  /** Non-null once removed — by its author, the video owner, or an admin. */
  deletedAt: string | null;
}

/**
 * One cursor-paged page of comments. The cursor is Cassandra's own paging state, base64'd — it is
 * passed back untouched and never parsed here.
 */
export interface AdminCommentPage {
  items: AdminCommentResponse[];
  nextCursor: string | null;
  hasMore: boolean;
}

/** admin-service — entity/ReportTargetType.java */
export type ReportTargetType = "USER" | "VIDEO" | "COMMENT";

/** admin-service — entity/ModerationActionType.java */
export type ModerationActionType =
  | "BAN_USER"
  | "UNBAN_USER"
  | "TAKEDOWN_VIDEO"
  | "RESTORE_VIDEO"
  | "REMOVE_COMMENT"
  | "WARN_USER"
  | "DISMISS_REPORT";

/** auth-service — entity/UserRole.java */
export type UserRole = "USER" | "ADMIN";

/** auth-service — entity/AuthProvider.java */
export type AuthProvider = "GOOGLE" | "FACEBOOK";

/** auth-service — entity/UserStatus.java */
export type UserStatus = "ACTIVE" | "LOCKED" | "BANNED";

/**
 * GET /api/v1/auth/admin/users — auth-service UserResponse.
 *
 * The directory lives on auth-service, not admin-service, because that is the database that
 * owns status and role. Banning goes the other way round, through admin-service, so the
 * decision lands in the moderation audit log.
 */
export interface AdminUserResponse {
  id: string;
  username: string;
  /** Null for a social account whose provider gave no address. */
  email: string | null;
  role: UserRole;
  status: UserStatus;
  emailVerified: boolean;
  emailVerifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** Last time a token pair was issued — a sign-in or a refresh. Null if it never has. */
  lastLoginAt: string | null;
  /** Set while status is BANNED; carries the reason from the ban event. Null otherwise. */
  bannedAt: string | null;
  /** When the ban lapses. Null on a permanent one — and on every account that is not banned. */
  bannedUntil: string | null;
  banReason: string | null;
  /** First linked social provider, or null for an email/password account. */
  provider: AuthProvider | null;
  linkedProviders: AuthProvider[];
}

/** GET /api/v1/users?ids= — user-service UserProfileResponse. Used to name a video's owner. */
export interface UserProfileResponse {
  userId: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  followerCount: number;
  followingCount: number;
}

/**
 * `PENDING_REVIEW` is the queue this console exists for: automatic moderation
 * was not confident enough to publish or to remove, so a person decides.
 *
 * `REJECTED` is the classifier's own removal and stays separate from
 * `TAKEN_DOWN`, an admin's — the thresholds behind the first are still being
 * tuned, and counting them together would hide how often it is wrong.
 */
export type VideoStatus =
  | "PROCESSING"
  | "PENDING_MODERATION"
  | "PENDING_REVIEW"
  | "PUBLISHED"
  | "FAILED"
  | "REJECTED"
  | "TAKEN_DOWN";
export type VideoVisibility = "PUBLIC" | "FRIENDS" | "PRIVATE";

/**
 * GET /api/v1/videos/admin — VideoResponse, served by video-service rather than admin-service:
 * that is the store owning status and visibility. Ids are Mongo document ids, not Snowflake
 * longs, so they are strings for a different reason than everything else here.
 */
export interface AdminVideoResponse {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  thumbnailUrl: string | null;
  previewUrl: string | null;
  hlsUrl: string | null;
  durationSeconds: number | null;
  status: VideoStatus;
  visibility: VideoVisibility;
  viewCount: number;
  likeCount: number;
  /** Null when the owner turned comments off — the service withholds the total entirely. */
  commentCount: number | null;
  commentsDisabled: boolean;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  /** First time the video went live; null if it never has. */
  publishedAt: string | null;
  /** Raw upload's object path in MinIO. Admin reads only — null on public responses. */
  rawFileUrl: string | null;
  /** Why the transcode gave up; null unless status is FAILED. */
  failureReason: string | null;
  /** Why moderation removed it; null unless status is TAKEN_DOWN. */
  takedownReason: string | null;
  /**
   * When the owner deleted the video. Only the by-id admin route ever returns a deleted video —
   * the listing drops them — so this is null on every row that came from a listing.
   */
  deletedAt: string | null;
  /** What the classifier scored. Admin reads only — the public API withholds it. */
  moderation: ModerationSummary | null;
}

/** The classifier's account of a video, the only explanation an auto-removed one carries. */
export interface ModerationSummary {
  verdict: 'APPROVED' | 'REVIEW' | 'REJECTED';
  label: string | null;
  maxScore: number;
  suspiciousFrames: number;
  totalFrames: number;
  model: string | null;
  modelVersion: string | null;
  /** Why no verdict could be reached; null unless the check itself failed. */
  reason: string | null;
  checkedAt: string;
}

/** GET /api/v1/admin/reports — ReportResponse */
export interface ReportResponse {
  id: string;
  reporterId: string;
  targetType: ReportTargetType;
  targetId: string;
  reason: string;
  status: ReportStatus;
  resolvedBy: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

/**
 * GET /api/v1/admin/reports/queue — ReportGroupResponse
 *
 * One row of the moderation worklist: every standing report against one target collapsed into
 * the single decision to be made about it. Distinct from {@link ReportResponse}, which is one
 * report — fifty people flagging one video is fifty of those and one of these.
 */
export interface ReportGroupResponse {
  targetType: ReportTargetType;
  targetId: string;
  reportCount: number;
  firstReportedAt: string;
  lastReportedAt: string;
  /** The newest report's scenario label, as the reporter picked it. */
  latestReason: string;
  /** The heaviest scenario reported against this target, 1–10. */
  severity: number;
  /** `reportCount × severity` — what the queue is ordered by, server-side. */
  priority: number;
}

/** GET /api/v1/admin/actions — ModerationActionResponse */
export interface ModerationActionResponse {
  id: string;
  adminId: string;
  actionType: ModerationActionType;
  targetType: ReportTargetType;
  targetId: string;
  reason: string;
  reportId: string | null;
  createdAt: string;
}

/** GET /api/v1/admin/stats/summary — StatsSummaryResponse */
export interface StatsSummaryResponse {
  pendingReports: number;
  resolvedReports: number;
  dismissedReports: number;
  actionsLast24h: number;
}

/** GET /api/v1/admin/stats/daily?days= — DailyAdminStatsResponse */
export interface DailyAdminStatsResponse {
  day: string;
  reportsCreated: number;
  actionsTaken: number;
}

/** GET /api/v1/analytics/engagement/daily?days= — DailyCountResponse */
export interface DailyCountResponse {
  day: string;
  eventType: string;
  count: number;
}

/** GET /api/v1/analytics/signups/daily?days= — DailySignupResponse */
export interface DailySignupResponse {
  day: string;
  signups: number;
}

/** GET /api/v1/analytics/active-users/daily?days= — DailyActiveUsersResponse */
export interface DailyActiveUsersResponse {
  day: string;
  activeUsers: number;
}

/** GET /api/v1/analytics/videos/top?days=&limit= — TopVideoResponse */
export interface TopVideoResponse {
  videoId: string;
  views: number;
  watchedMs: number;
  completions: number;
  viewers: number;
}

/**
 * GET /api/v1/admin/settings/moderation — admin-service proxying moderation-service's /config.
 *
 * `values` is passed through untyped on purpose: admin-service does not read it either, so a
 * field added on the moderation side shows up here without a release on this side.
 */
export interface ModerationSettingsResponse {
  values: Record<string, string | number | boolean | string[]>;
  reachable: boolean;
}

/** common-lib ApiResponse<T> — every service wraps its payload in this */
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  code?: string;
  message?: string;
  timestamp: string;
}

/** Spring Data Page<T>, as serialized by the admin-service list endpoints */
export interface Page<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}
