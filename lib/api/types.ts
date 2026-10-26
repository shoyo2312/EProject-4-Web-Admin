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
export type AdminCommentFilter = "THREAD" | "REPLIES" | "REMOVED" | "HELD";

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
  /** HELD while it waits for the video's owner to approve it — such a comment was never public. */
  status: AdminCommentStatus;
  /**
   * Every flag text moderation raised on it, most severe first, "; " between them — see
   * lib/text-flags. Null when nothing fired. A posted comment with one is something a filter let
   * through: a link its owner waived, a classifier note.
   */
  moderationReason: string | null;
}

/** interaction-service — entity/CommentStatus.java. Rows written before held comments read VISIBLE. */
export type AdminCommentStatus = "VISIBLE" | "HELD";

/** moderation-lib — Category.java: what text moderation files a flag under. */
export type TextCategory =
  | "PROFANITY"
  | "INSULT"
  | "HATE"
  | "SEXUAL"
  | "VIOLENCE"
  | "SCAM"
  | "SPAM"
  | "PERSONAL_INFO"
  | "CREATOR_FILTER";

/** video-service — CaptionModeration.Field: which part of a caption a flag was found in. */
export type CaptionField = "TITLE" | "DESCRIPTION" | "TAGS";

/**
 * One cursor-paged page of comments. The cursor is Cassandra's own paging state, base64'd — it is
 * passed back untouched and never parsed here.
 */
export interface AdminCommentPage {
  items: AdminCommentResponse[];
  nextCursor: string | null;
  hasMore: boolean;
}

/**
 * GET /api/v1/interactions/admin/users/{userId}/comment-restriction — interaction-service
 * CommentRestrictionResponse: where an account stands with the comment strikes.
 *
 * A strike is a comment the rules refused or an admin removed; enough of them within a day stop
 * the account commenting for a while, each restriction in a row longer than the last. Kept in
 * Redis and failing open, so an unreachable store reads as a clean record — which is also how the
 * service treats the account then.
 */
export interface CommentRestrictionResponse {
  userId: string;
  /** When the current restriction ends; null when there is none. */
  restrictedUntil: string | null;
  /** Strikes counting toward the next restriction. A restriction starting resets them to 0. */
  strikes: number;
  /**
   * Restrictions in a row: back to 0 after 30 days (the step window) without one. The next
   * restriction lasts the duration after this many — 1 hour, a day, a week by default.
   */
  step: number;
}

/** admin-service — entity/ReportTargetType.java */
export type ReportTargetType = "USER" | "VIDEO" | "COMMENT";

/** admin-service — entity/ModerationActionType.java */
export type ModerationActionType =
  | "BAN_USER"
  | "UNBAN_USER"
  | "TAKEDOWN_VIDEO"
  | "RESTORE_VIDEO"
  | "PURGE_VIDEO"
  | "REMOVE_COMMENT"
  | "WARN_USER"
  | "REVOKE_SESSIONS"
  | "DISMISS_REPORT";

/** auth-service — entity/UserRole.java */
export type UserRole = "USER" | "ADMIN";

/** auth-service — entity/AuthProvider.java */
export type AuthProvider = "GOOGLE" | "FACEBOOK";

/** auth-service — entity/UserStatus.java */
export type UserStatus = "ACTIVE" | "LOCKED" | "BANNED" | "DEACTIVATED";

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
  /** When the owner closed it, or null. Survives a ban, so a BANNED account can carry it too. */
  deactivatedAt: string | null;
  /** When the owner's deletion runs — a ban does not stop it — or null. */
  deletionScheduledAt: string | null;
  /** First linked social provider, or null for an email/password account. */
  provider: AuthProvider | null;
  linkedProviders: AuthProvider[];
}

/**
 * What auth-service records in `auth_security_events`. Names match the Java enum; an unknown
 * one is possible if the service ships a new kind before the console does, so the timeline
 * falls back rather than assuming this list is complete.
 */
export type SecurityEventType =
  | "LOGIN_SUCCEEDED"
  | "LOGIN_FAILED"
  | "LOGOUT"
  | "PASSWORD_RESET_REQUESTED"
  | "PASSWORD_RESET_COMPLETED"
  | "EMAIL_CHANGED"
  | "EMAIL_VERIFIED"
  | "MFA_CHALLENGED"
  | "DEVICE_REMEMBERED"
  | "SESSIONS_REVOKED";

/**
 * GET /api/v1/auth/admin/users/{id}/security-events — one entry of an account's security log.
 *
 * Token refreshes are not in here, and neither are bans: refreshes because a client makes one
 * every fifteen minutes, bans because they are moderation decisions already recorded with their
 * admin and reason in admin-service's audit log.
 */
export interface SecurityEventResponse {
  id: string;
  eventType: SecurityEventType;
  /** The address api-gateway resolved, or null when nothing HTTP caused the entry. */
  ipAddress: string | null;
  userAgent: string | null;
  /** "Chrome on macOS" — null when the agent named nothing recognised. */
  deviceLabel: string | null;
  /**
   * The approximate place of the address — "Ho Chi Minh City, Vietnam", sometimes the country
   * alone — looked up when the event happened. Null for older entries and for addresses that
   * resolve to nothing.
   */
  location: string | null;
  /** A short phrase: the new address, why sessions were revoked. Never a secret. */
  detail: string | null;
  createdAt: string;
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
  /** When the owner deleted the video. Null for a video that has never been deleted. */
  deletedAt: string | null;
  /**
   * When the VideoPurgedEvent went out — media-worker erases the media on it, so from here on
   * nothing plays. Null for a live video and for a deleted one still in the trash.
   */
  purgeEventPublishedAt: string | null;
  /** What the classifier scored. Admin reads only — the public API withholds it. */
  moderation: ModerationSummary | null;
  /**
   * What text moderation made of the title, description and tags at publish. Admin reads only,
   * like `moderation`. Null for an upload published before captions were screened.
   */
  textModeration: TextModerationSummary | null;
}

/** video-service — TextModerationResponse. */
export interface TextModerationSummary {
  /** Never REJECTED in practice: a caption that bad refuses the publish, and nothing is stored. */
  verdict: ModerationSummary["verdict"];
  /** "DESCRIPTION:SPAM:link:bit.ly" — field, category, what fired — classifier notes included. */
  flags: string[];
  /** `rules-<list>+admin-<revision>`, then `+<model version>` when the classifier answered. */
  version: string;
  /** False when the verdict was only recorded, not acted on — the rules were measuring. */
  enforced: boolean;
  checkedAt: string;
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

/**
 * GET /api/v1/admin/stats/daily?days= — DailyAdminStatsResponse
 *
 * Two clocks: `reportsCreated` and the three action counts are dated by when the row was
 * written, `reportsResolved` / `reportsDismissed` by when the report was closed. A report
 * filed in March and dismissed in September belongs to September here.
 */
export interface DailyAdminStatsResponse {
  day: string;
  reportsCreated: number;
  actionsTaken: number;
  reportsResolved: number;
  reportsDismissed: number;
  usersBanned: number;
  videosTakenDown: number;
  commentsRemoved: number;
}

/**
 * GET /api/v1/videos/admin/stats/daily?days= — DailyVideoStatsResponse
 *
 * `uploads` is a flow. The other two are cohort counts: of the videos uploaded that day, how
 * many are *now* awaiting review or unwatchable. Nothing stamps a status change, and both are
 * states a video passes through quickly, so this answers "is the backlog growing" and nothing
 * that needs the day a decision was made.
 */
export interface DailyVideoStatsResponse {
  day: string;
  uploads: number;
  pendingReview: number;
  notPlayable: number;
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
 * GET /api/v1/analytics/engagement/videos/{videoId} — VideoEngagementSummaryResponse. All-time,
 * counted from the event stream: likes net of unlikes, comments net of deleted ones.
 */
export interface VideoEngagementSummaryResponse {
  videoId: string;
  likes: number;
  comments: number;
  shares: number;
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

/**
 * moderation-lib — AdminTerm.Action. HOLD and REJECT add a term at severity 2 and 3; EXEMPT takes a
 * term out of the list every service ships with, for a false positive until the next release.
 */
export type ModerationTermAction = "HOLD" | "REJECT" | "EXEMPT";

/** GET /api/v1/admin/moderation/terms — ModerationTermResponse. Live terms only, newest first. */
export interface ModerationTermResponse {
  id: string;
  /** As the admin typed it, sanitized to one line. How it is written decides how it matches. */
  term: string;
  /** Null for EXEMPT, which flags nothing. */
  category: TextCategory | null;
  action: ModerationTermAction;
  note: string | null;
  createdBy: string;
  createdAt: string;
}

/** POST /api/v1/admin/moderation/terms — AddModerationTermRequest. */
export interface AddModerationTermRequest {
  term: string;
  /** Required for HOLD and REJECT, never CREATOR_FILTER; ignored for EXEMPT. */
  category: TextCategory | null;
  action: ModerationTermAction;
  note: string | null;
}

/** GET /api/v1/admin/moderation/terms/summary — ModerationTermSummaryResponse. */
export interface ModerationTermSummaryResponse {
  /** The `version:` line of the list the services ship with. */
  shippedVersion: string;
  shippedTerms: number;
  /** Moved by every add and every removal; 0 before the first. */
  revision: number;
  /** Live admin terms, EXEMPT included. */
  adminTerms: number;
  /** What a verdict made with this list records: `rules-<shipped>+admin-<revision>`. */
  version: string;
}

/** moderation-lib — Surface: where a text would be shown, which changes what a link means. */
export type TextSurface = "COMMENT" | "VIDEO_TITLE" | "VIDEO_DESCRIPTION" | "VIDEO_TAGS";

/** moderation-lib — Decision, least severe first. */
export type TextDecision = "ALLOW" | "HOLD" | "REJECT";

/** moderation-lib — Flag.Source: who raised a flag, which decides which switch it answers to. */
export type TextFlagSource = "RULES" | "MODEL" | "CREATOR";

/** moderation-lib — Flag, as the preview returns it: whole, where stored records keep only `CATEGORY:rule`. */
export interface TextFlagResponse {
  category: TextCategory;
  /** 3 refuses the text, 2 sends it to a person, 1 is a note that decides nothing. */
  severity: number;
  /** What fired: `term:<term>`, `link:<domain>`, `phone`, `model:<label>:<score>`… */
  rule: string;
  source: TextFlagSource;
}

/**
 * POST /api/v1/admin/moderation/text-preview — TextPreviewResponse. What screening makes of a text
 * right now, before any service's switches: whether a service acts on a HOLD or a REJECT is its
 * own enforce setting, and a video owner's comment filters come on top.
 */
export interface TextPreviewResponse {
  decision: TextDecision;
  /** Everything that fired, most severe first, notes included. */
  flags: TextFlagResponse[];
  version: string;
  /** False when the classifier is off or did not answer: the decision is then the rules' alone. */
  classifierAnswered: boolean;
}

/** user-service DataExportFormat. */
export type DataExportFormat = "TXT" | "JSON";

/** user-service DataExportCategory — what an owner chose to put in their archive. */
export type DataExportCategory =
  | "DIRECT_MESSAGES"
  | "LIKES_AND_FAVORITES"
  | "POSTS"
  | "PROFILE_AND_SETTINGS"
  | "YOUR_ACTIVITY";

/** One request "Download your data" gave up on after every attempt. */
export interface FailedDataExport {
  id: string;
  userId: string;
  format: DataExportFormat;
  categories: DataExportCategory[];
  attempts: number;
  requestedAt: string;
  failedAt: string;
}

/**
 * GET /api/v1/users/admin/data-exports/summary — DataExportAdminSummaryResponse. The archive
 * builds platform-wide; erased accounts are left out.
 */
export interface DataExportSummaryResponse {
  /** Waiting for, or being built by, the worker. */
  processing: number;
  /** When the longest-waiting of them was made; null when none is. */
  oldestProcessingSince: string | null;
  /** Of `processing`, those older than every attempt's lease together — no worker is getting through them. */
  stalled: number;
  /** Finished archives still downloadable, so still taking space in MinIO. */
  readyFiles: number;
  /** Start of the window `failed` counts — seven days back. */
  failedSince: string;
  failed: number;
  /** The latest twenty of `failed`, newest first. */
  recentFailures: FailedDataExport[];
}

/**
 * GET /api/v1/admin/system/dead-letters — admin-service DeadLetterTopicResponse. One `<topic>.DLT`
 * kafka-lib's error handler parked records on; a topic only exists once something was parked.
 */
export interface DeadLetterTopicResponse {
  /** The DLT's full name, `video.video-events.DLT`. */
  topic: string;
  originTopic: string;
  /** Records the broker still holds — retention removes them, a replay does not. */
  retained: number;
  /** Of those, the ones no replay of every pending record has been past yet. */
  pending: number;
  /** When the newest was parked; null when the broker holds none. */
  latestAt: string | null;
}

/** kafka-lib ReplayResult.Outcome. NOT_FOUND never reaches the console: it is a 404. */
export type DeadLetterReplayOutcome =
  | "REPLAYED"
  | "HELD_BACK"
  | "ALREADY_REPLAYED"
  | "NOT_PARKED"
  | "NOT_FOUND";

/** DeadLetterRecordResponse.LastReplay — the latest replay of a record from the console. */
export interface DeadLetterLastReplay {
  outcome: DeadLetterReplayOutcome;
  /** Where it went, what held it back, or where the earlier replay is. */
  detail: string | null;
  forced: boolean;
  adminId: string;
  at: string;
}

/**
 * One DLT record — where and why it failed, never the payload: that is an event's content, and
 * deciding on a replay does not need it.
 */
export interface DeadLetterRecordResponse {
  partition: number;
  offset: number;
  parkedAt: string;
  key: string | null;
  /** Null for a producer that sends no eventType header. */
  eventType: string | null;
  /** `topic-partition@offset` it failed at; null for a record kafka-lib did not park. */
  origin: string | null;
  /** The consumer group whose listener failed on it. */
  consumerGroup: string | null;
  /** The deepest cause of the failure, one line. */
  error: string | null;
  /** A replay of every pending record would still reach it. */
  pending: boolean;
  lastReplay: DeadLetterLastReplay | null;
}

/** GET /api/v1/admin/system/dead-letters/{topic}?limit= — the newest records, newest first. */
export interface DeadLetterRecordsResponse {
  topic: DeadLetterTopicResponse;
  records: DeadLetterRecordResponse[];
}

/** POST …/{topic}/replay — one record. */
export interface DeadLetterReplayResponse {
  partition: number;
  offset: number;
  outcome: DeadLetterReplayOutcome;
  detail: string | null;
}

/** POST …/{topic}/replay-pending — the next batch of pending records, never forced. */
export interface DeadLetterBatchReplayResponse {
  results: DeadLetterReplayResponse[];
  /** What is left for another call: a batch has a cap, and one that runs out of time stops early. */
  stillPending: number;
}

/** One outbox as kafka-lib's OutboxBacklog gauges report it. */
export interface OutboxBacklog {
  name: string;
  /** Rows still waiting for a broker ack; null when the service could not count them — its own database did not answer. */
  pending: number | null;
  /** How long the oldest of them has been due, 0 when none is; null as above. A count cannot tell busy from stuck — this can. */
  oldestPendingAgeSeconds: number | null;
}

/** GET /api/v1/admin/system/outboxes — admin-service OutboxBacklogResponse, one per service with an outbox. */
export interface OutboxBacklogResponse {
  service: string;
  /** False when its actuator did not answer; `outboxes` is then empty. */
  reachable: boolean;
  outboxes: OutboxBacklog[];
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
