import type {
  AdminUserResponse,
  AdminVideoResponse,
  ModerationActionResponse,
  ReportResponse,
  SecurityEventResponse,
  SecurityEventType,
} from "@/lib/api/types";

/**
 * One account's history, assembled from the five places the platform records it: auth-service's
 * security log and account fields, admin-service's moderation actions, admin-service's report
 * ledger, and video-service's uploads.
 *
 * Every source is normalised into one {@link ActivityEvent} shape before anything is merged,
 * so a new source is a new mapper and nothing else — which is how the login/IP/device events
 * from an `auth_security_events` table will land here without the page changing.
 *
 * Pure on purpose: the fetching lives in the route, so the merge, the ordering and the
 * de-duplication can be checked by `activity.check.mjs` without a backend.
 */

export const ACTIVITY_CATEGORIES = ["security", "content", "moderation"] as const;

export type ActivityCategory = (typeof ACTIVITY_CATEGORIES)[number];

/** The category filter's URL values — the three categories plus "everything". */
export type ActivityFilter = ActivityCategory | "all";

export interface ActivityEvent {
  /** Stable across renders so React keys and the page slice agree. */
  id: string;
  /** ISO 8601. */
  at: string;
  category: ActivityCategory;
  /** Machine-readable, `domain.verb` — what the row's icon and colour key off. */
  kind: string;
  summary: string;
  /** The recorded reason, or whatever detail the source carries. */
  detail?: string;
  /** Where the row leads, if it leads anywhere. */
  href?: string;
  /** Who did it: an admin, the account itself, or the platform. */
  actor?: string;
  /**
   * Set when `at` is the closest timestamp available rather than the recorded moment. A
   * reviewer reading a compliance trail has to be able to tell the two apart.
   */
  approximate?: boolean;
}

/**
 * How far apart a ban recorded on the account and the moderation action that caused it may
 * sit before they stop being treated as the same event. The action is written by
 * admin-service and `banned_at` by auth-service consuming the event it publishes, so the two
 * clocks differ by a queue hop.
 */
const BAN_DEDUPE_WINDOW_MS = 24 * 60 * 60 * 1000;

export function buildUserActivity(input: {
  user: AdminUserResponse;
  /** Moderation actions whose target is this account. */
  actions: ModerationActionResponse[];
  uploads: AdminVideoResponse[];
  reportsFiled: ReportResponse[];
  reportsReceived: ReportResponse[];
  /** auth-service's security log. Empty for an account that predates it. */
  securityEvents?: SecurityEventResponse[];
  /** The log holds more entries than `securityEvents` — only its newest page was fetched. */
  securityLogTruncated?: boolean;
}): ActivityEvent[] {
  const { user, actions, uploads, reportsFiled, reportsReceived } = input;
  const securityEvents = input.securityEvents ?? [];

  return [
    ...accountEvents(
      user,
      actions,
      new Set(securityEvents.map((event) => event.eventType)),
      input.securityLogTruncated ?? false,
    ),
    ...securityEvents.map(securityEvent),
    ...actions.map(actionEvent),
    ...uploads.flatMap(videoEvents),
    ...reportsFiled.map(reportFiledEvent),
    ...reportsReceived.map(reportReceivedEvent),
  ].sort(newestFirst);
}

/** Newest first, with the id breaking ties so the order is stable rather than merely sorted. */
function newestFirst(a: ActivityEvent, b: ActivityEvent): number {
  const delta = Date.parse(b.at) - Date.parse(a.at);
  return delta !== 0 ? delta : a.id.localeCompare(b.id);
}

/**
 * What auth-service records on the account row itself, rather than in its security log.
 *
 * Two of these are stand-ins, and they step aside once the real thing is present: `lastLoginAt`
 * is one advancing timestamp where the log has every sign-in with its address and device, and
 * `emailVerifiedAt` is a single field where the log has the event. Left in alongside, each would
 * put one thing in the timeline twice, a few seconds apart, which reads as two things.
 *
 * Registration has no stand-in to retire — nothing records it in the log — so it is always here.
 */
function accountEvents(
  user: AdminUserResponse,
  actions: ModerationActionResponse[],
  recorded: Set<SecurityEventType>,
  truncated: boolean,
): ActivityEvent[] {
  const events: ActivityEvent[] = [
    {
      id: "account.created",
      at: user.createdAt,
      category: "security",
      kind: "account.created",
      summary: "Account registered",
      detail:
        user.linkedProviders.length > 0
          ? `via ${user.linkedProviders.join(", ")}`
          : "email / password",
      actor: `@${user.username}`,
    },
  ];

  if (user.emailVerifiedAt && !recorded.has("EMAIL_VERIFIED")) {
    events.push({
      id: "account.email_verified",
      at: user.emailVerifiedAt,
      category: "security",
      kind: "account.email_verified",
      summary: "Email address verified",
      detail: user.email ?? undefined,
      actor: `@${user.username}`,
    });
  }

  if (user.lastLoginAt && !recorded.has("LOGIN_SUCCEEDED")) {
    events.push({
      id: "account.last_login",
      at: user.lastLoginAt,
      category: "security",
      kind: "account.last_login",
      summary: "Most recent sign-in or token refresh",
      // Said plainly because one row here looks like one sign-in and is not: the column is
      // overwritten on every refresh, so every earlier one has already been lost. Only reached
      // when the security log holds no sign-in for this account — an account last active before
      // the log existed, or one that has never signed in since — or when the page of it fetched
      // holds none, as on an account whose newest entries are a run of failed guesses. The log
      // may well have sign-ins then, so the detail must not say it has none.
      detail: truncated
        ? "No sign-in among the security-log entries loaded here — older entries were not fetched"
        : "No sign-in recorded in the security log — this single timestamp is all that is left",
      actor: `@${user.username}`,
    });
  }

  // The standing ban already has a row if the action that imposed it is in the log, and that
  // row is the better one — it names the admin and the reason. This covers the case where it
  // is not: a ban older than the audit log, or one applied outside it.
  if (user.bannedAt && !hasMatchingBan(user.bannedAt, actions)) {
    events.push({
      id: "account.banned",
      at: user.bannedAt,
      category: "security",
      kind: "account.banned",
      summary: user.bannedUntil ? "Account suspended" : "Account banned permanently",
      detail: user.banReason ?? "no reason recorded",
      actor: "unrecorded — no matching audit action",
    });
  }

  return events;
}

function hasMatchingBan(bannedAt: string, actions: ModerationActionResponse[]): boolean {
  const banned = Date.parse(bannedAt);
  return actions.some(
    (action) =>
      action.actionType === "BAN_USER"
      && Math.abs(Date.parse(action.createdAt) - banned) <= BAN_DEDUPE_WINDOW_MS,
  );
}

const SECURITY_SUMMARY: Record<SecurityEventType, string> = {
  LOGIN_SUCCEEDED: "Signed in",
  LOGIN_FAILED: "Failed sign-in attempt",
  LOGOUT: "Signed out",
  PASSWORD_RESET_REQUESTED: "Password reset requested",
  PASSWORD_RESET_COMPLETED: "Password changed via reset",
  EMAIL_CHANGED: "Email address changed",
  EMAIL_VERIFIED: "Email address verified",
  MFA_CHALLENGED: "Two-factor code sent",
  DEVICE_REMEMBERED: "Browser trusted — two-factor skipped on it",
  SESSIONS_REVOKED: "All sessions revoked",
};

/**
 * One entry of auth-service's security log.
 *
 * <p>The device and the address go in the detail line rather than the summary: a history is
 * scanned down the left edge for what happened, and "Signed in · Chrome on macOS · 203.0.113.7"
 * on one line makes every row as wide as its longest part. The summary falls back to the raw
 * name, so a kind this console has not been taught yet still draws a row instead of an empty one.
 */
function securityEvent(event: SecurityEventResponse): ActivityEvent {
  return {
    id: `security.${event.id}`,
    at: event.createdAt,
    category: "security",
    kind: `security.${event.eventType.toLowerCase()}`,
    summary: SECURITY_SUMMARY[event.eventType] ?? event.eventType,
    detail: [event.detail, event.deviceLabel, event.ipAddress].filter(Boolean).join(" · ")
      || undefined,
  };
}

const ACTION_SUMMARY: Record<string, string> = {
  BAN_USER: "Banned by moderation",
  UNBAN_USER: "Ban lifted",
  TAKEDOWN_VIDEO: "Video taken down",
  RESTORE_VIDEO: "Video restored",
  PURGE_VIDEO: "Video permanently deleted from trash",
  REMOVE_COMMENT: "Comment removed",
  WARN_USER: "Warning issued",
  REVOKE_SESSIONS: "Signed out of every session",
};

function actionEvent(action: ModerationActionResponse): ActivityEvent {
  return {
    id: `action.${action.id}`,
    at: action.createdAt,
    category: "moderation",
    kind: `moderation.${action.actionType.toLowerCase()}`,
    summary: ACTION_SUMMARY[action.actionType] ?? action.actionType,
    detail: action.reason,
    href: "/moderation/actions",
    actor: `admin #${shortActor(action.adminId)}`,
  };
}

/**
 * What video-service records about one upload. `createdAt` and `deletedAt` are real recorded
 * moments; a takedown is not — video-service keeps the reason and the status but not when the
 * status changed, so the row is dated by `updatedAt` and marked approximate.
 *
 * ponytail: the exact moment is in admin-service's audit log under the video's own id, but
 * reading it would be one request per upload. Batch it behind a `targetIds` parameter on
 * `/api/v1/admin/actions` if an exact takedown clock ever matters here.
 */
function videoEvents(video: AdminVideoResponse): ActivityEvent[] {
  const events: ActivityEvent[] = [
    {
      id: `video.uploaded.${video.id}`,
      at: video.createdAt,
      category: "content",
      kind: "video.uploaded",
      summary: `Uploaded “${video.title}”`,
      detail:
        video.visibility === "PUBLIC" ? undefined : `${video.visibility.toLowerCase()} upload`,
      href: `/videos/${video.id}`,
    },
  ];

  if (video.deletedAt) {
    events.push({
      id: `video.deleted.${video.id}`,
      at: video.deletedAt,
      category: "content",
      kind: "video.deleted",
      summary: `Deleted “${video.title}”`,
      detail: "by the owner — held in trash before purge",
      href: `/videos/${video.id}`,
    });
  }

  if (video.status === "TAKEN_DOWN") {
    events.push({
      id: `video.taken_down.${video.id}`,
      at: video.updatedAt,
      category: "moderation",
      kind: "video.taken_down",
      summary: `“${video.title}” taken down`,
      detail: video.takedownReason ?? "no reason recorded",
      href: `/videos/${video.id}`,
      approximate: true,
    });
  }

  return events;
}

function reportFiledEvent(report: ReportResponse): ActivityEvent {
  return {
    id: `report.filed.${report.id}`,
    at: report.createdAt,
    category: "moderation",
    kind: "report.filed",
    summary: `Reported a ${report.targetType.toLowerCase()}`,
    detail: report.reason,
    href: "/moderation/reports",
  };
}

function reportReceivedEvent(report: ReportResponse): ActivityEvent {
  return {
    id: `report.received.${report.id}`,
    at: report.createdAt,
    category: "moderation",
    kind: "report.received",
    summary: "Reported by another user",
    detail: report.reason,
    href: "/moderation/reports",
    actor: `reporter #${shortActor(report.reporterId)}`,
  };
}

/** Enough of an id to tell two admins apart in a list without printing a snowflake in full. */
function shortActor(id: string): string {
  return id.slice(-6);
}

export function filterActivity(events: ActivityEvent[], filter: ActivityFilter): ActivityEvent[] {
  return filter === "all" ? events : events.filter((event) => event.category === filter);
}

export function parseActivityFilter(value: string | undefined): ActivityFilter {
  return ACTIVITY_CATEGORIES.includes(value as ActivityCategory)
    ? (value as ActivityCategory)
    : "all";
}

/**
 * One page of the merged list.
 *
 * ponytail: paged here rather than by the services, because five sources cannot be paged
 * against each other — page 2 of each is not page 2 of the merge. The route fetches a bounded
 * window from every source and this slices the result, so a very long-lived account shows its
 * most recent history and not all of it. The fix, if one is ever needed, is a real
 * activity-event table that all of this is written to; `totalElements` is then the table's.
 */
export function pageOfActivity(
  events: ActivityEvent[],
  page: number,
  size: number,
): { rows: ActivityEvent[]; page: number; totalPages: number; totalElements: number } {
  const totalPages = Math.max(1, Math.ceil(events.length / size));
  // A filter change can leave the URL on a page the narrowed list no longer has.
  const safePage = Math.min(Math.max(page, 0), totalPages - 1);
  return {
    rows: events.slice(safePage * size, safePage * size + size),
    page: safePage,
    totalPages,
    totalElements: events.length,
  };
}
