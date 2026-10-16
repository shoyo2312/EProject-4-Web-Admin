import type {
  ModerationActionType,
  ModerationTermAction,
  ReportStatus,
  ReportTargetType,
  UserStatus,
  VideoStatus,
} from "@/lib/api/types";

/**
 * A listing page's query string, as the page reads it and as its "export all" hands it on, so the
 * export matches exactly what the page shows.
 *
 * Every value arrives from there, where anything at all can be typed. One the backend does not
 * know becomes "no filter" rather than being passed on: Spring answers an enum it does not know
 * with a 400 for the whole page, and an unknown sort property with a 500.
 */
export type ListParams = Partial<Record<string, string>>;

function oneOf<T extends string>(value: string | undefined, allowed: readonly T[]): T | undefined {
  return allowed.includes(value as T) ? (value as T) : undefined;
}

const USER_STATUSES: readonly UserStatus[] = ["ACTIVE", "BANNED", "LOCKED"];

const VIDEO_STATUSES: readonly VideoStatus[] = [
  "PROCESSING",
  "PENDING_MODERATION",
  "PENDING_REVIEW",
  "PUBLISHED",
  "FAILED",
  "REJECTED",
  "TAKEN_DOWN",
];

const REPORT_STATUSES: readonly ReportStatus[] = ["PENDING", "RESOLVED", "DISMISSED"];

const REPORT_TARGET_TYPES: readonly ReportTargetType[] = ["USER", "VIDEO", "COMMENT"];

/**
 * The columns admin-service will order the report ledger by — the Report entity's own fields.
 *
 * Here rather than in `api/admin.ts` because the ledger's header buttons need it too, and that
 * module is server-only.
 */
export const REPORT_SORT_FIELDS = ["id", "targetType", "status", "createdAt"] as const;

export type ReportSortField = (typeof REPORT_SORT_FIELDS)[number];

/**
 * The columns admin-service will order the audit log by. Not the admin: the log holds an id, and
 * ordering by it would group the rows without putting the names in any order a reader expects.
 */
export const ACTION_SORT_FIELDS = ["createdAt", "actionType", "targetType"] as const;

export type ActionSortField = (typeof ACTION_SORT_FIELDS)[number];

/** Every decision admin-service records — the audit log's type filter. */
export const ACTION_TYPES: readonly ModerationActionType[] = [
  "BAN_USER",
  "UNBAN_USER",
  "WARN_USER",
  "REVOKE_SESSIONS",
  "TAKEDOWN_VIDEO",
  "RESTORE_VIDEO",
  "PURGE_VIDEO",
  "REMOVE_COMMENT",
  "DISMISS_REPORT",
];

/** What a match on an admin term does — the Terms page's filter tabs, in their order. */
export const TERM_ACTIONS: readonly ModerationTermAction[] = ["HOLD", "REJECT", "EXEMPT"];

export function userFilters(params: ListParams) {
  return { q: params.q, status: oneOf(params.status, USER_STATUSES) };
}

export function videoFilters(params: ListParams) {
  // One account's uploads, by id — where an account page's "All N" link lands. Exact, unlike a
  // search for the handle, which also matches other handles and titles that contain it. The two
  // are one search expressed two ways (video-service ORs them), so the exact one replaces the term.
  const ownerId = /^\d+$/.test(params.owner ?? "") ? params.owner : undefined;
  return {
    q: ownerId ? undefined : params.q,
    ownerId,
    status: oneOf(params.status, VIDEO_STATUSES),
    // Not a VideoStatus: a video keeps its pipeline status after its owner deletes it, so
    // "Deleted" filters on deletedAt instead — listVideos({ deleted: true }).
    deletedOnly: params.status === "DELETED",
  };
}

export function reportFilters(params: ListParams) {
  return {
    q: params.q?.trim() || undefined,
    status: oneOf(params.status, REPORT_STATUSES),
    targetType: oneOf(params.target, REPORT_TARGET_TYPES),
    sort: oneOf(params.sort, REPORT_SORT_FIELDS) ?? "createdAt",
    ascending: params.dir === "asc",
  };
}

/** The period is not here: it comes from the page's time window, like every dated figure. */
export function auditFilters(params: ListParams) {
  return {
    adminId: /^\d+$/.test(params.admin ?? "") ? params.admin : undefined,
    actionType: oneOf(params.type, ACTION_TYPES),
    // Anything else is a 400 from admin-service; the log falls back to newest first.
    sort: oneOf(params.sort, ACTION_SORT_FIELDS) ?? "createdAt",
    ascending: params.dir === "asc",
  };
}

export function termFilters(params: ListParams) {
  return { q: params.q?.trim() || undefined, action: oneOf(params.action, TERM_ACTIONS) };
}
