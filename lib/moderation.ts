import type { ModerationActionType, VideoStatus } from "@/lib/api/types";

/**
 * Whether the file behind a video can actually be played back, which is also whether its view
 * and like totals mean anything.
 *
 * The moderation states qualify: the video is transcoded and playable, it is only held back —
 * and a reviewer has to watch it to decide. PROCESSING and FAILED do not: there is no file yet,
 * or there never will be.
 */
export function playable(status: VideoStatus): boolean {
  return (
    status === "PUBLISHED"
    || status === "TAKEN_DOWN"
    || status === "REJECTED"
    || status === "PENDING_REVIEW"
    || status === "PENDING_MODERATION"
  );
}

/**
 * Action types with a live downstream consumer today:
 * video-service (takedown/restore), auth-service (ban/unban),
 * interaction-service (comment removal). The rest are recorded in
 * moderation_actions and published to admin.moderation-events with no
 * subscriber, so the log says so rather than implying the action landed.
 *
 * Lives outside the client component so server components can read the
 * array itself instead of a client reference proxy.
 */
export const ENFORCED: ModerationActionType[] = [
  "TAKEDOWN_VIDEO",
  "RESTORE_VIDEO",
  "BAN_USER",
  "UNBAN_USER",
  "REMOVE_COMMENT",
];

/**
 * The columns admin-service will order the report ledger by — the Report entity's own fields.
 *
 * Whitelisted rather than passed through: the value reaches the API from the query string,
 * where anything at all can be typed, and Spring answers an unknown sort property with a 500.
 *
 * It lives here rather than in `api/admin.ts` because the ledger's header buttons need it too,
 * and that module is server-only.
 */
export const REPORT_SORT_FIELDS = ["id", "targetType", "status", "createdAt"] as const;

export type ReportSortField = (typeof REPORT_SORT_FIELDS)[number];

/** The four enforcements an admin can start from a directory row or a target's own page. */
export type EnforcementAction = "ban" | "unban" | "takedown" | "restore";

/**
 * Preset reasons, per enforcement. They are written to read on their own months later, because
 * what ends up in the audit row is this exact string and nothing else — "spam" alone tells a
 * reviewer nothing about what the account actually did.
 *
 * Shortcuts, not a closed list: a preset fills the box and the box stays editable, so an admin
 * can pick the closest one and add the specifics. That is also the "other" case — there is no
 * separate mode to switch into, just an empty box.
 *
 * One copy, because the wording is what the audit log is made of: a takedown reason offered on
 * the videos table and a different one offered on the video's own page would show up months
 * later as two vocabularies for the same decision.
 *
 * `removeComment` is not an {@link EnforcementAction} — it is started from the comment console
 * rather than from a directory row, and has no undo — but its reasons land in the same audit
 * log and so belong in the same vocabulary.
 */
export const PRESET_REASONS: Record<EnforcementAction | "removeComment", readonly string[]> = {
  ban: [
    "Repeated policy violations",
    "Spam or bot activity",
    "Harassment or hate speech",
    "Sexual content involving a minor",
    "Scam or fraudulent selling",
    "Impersonating another person",
    "Ban evasion — duplicate account",
    "Compromised account",
  ],
  unban: [
    "Appeal upheld — no violation",
    "Banned in error",
    "Reviewed again, within policy",
    "Account recovered by its owner",
  ],
  takedown: [
    "Sexual or nude content",
    "Graphic violence",
    "Hate speech or harassment",
    "Dangerous act likely to be imitated",
    "Spam or scam",
    "Copyright infringement",
    "Harmful misinformation",
    "Involves a minor",
  ],
  restore: [
    "Reviewed — automatic flag was wrong",
    "Appeal upheld — no violation",
    "Taken down in error",
    "Reviewed again, within policy",
    "Rights holder withdrew the claim",
  ],
  removeComment: [
    "Harassment or targeted abuse",
    "Hate speech",
    "Spam or scam link",
    "Sexual content",
    "Threat of violence",
    "Doxxing — shares private information",
    "Impersonation",
    "Off-platform solicitation",
  ],
};
