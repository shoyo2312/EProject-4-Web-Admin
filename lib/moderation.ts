import type { ModerationActionType, ReportTargetType, VideoStatus } from "@/lib/api/types";

/** What a moderation server action answers: whether it was recorded, and the sentence to show. */
export interface ModerationResult {
  ok: boolean;
  message: string;
}

/**
 * A COMMENT target is stored as "videoId:commentId" — admin-service's CommentTarget, and what the
 * client sends — because comments are partitioned by video and the comment id alone reaches
 * nothing. Null for any other shape, rather than a guessed video.
 */
export function parseCommentTarget(targetId: string): { videoId: string; commentId: string } | null {
  const [videoId, commentId, ...rest] = targetId.split(":");
  if (!videoId || !commentId || rest.length > 0) return null;
  return { videoId, commentId };
}

/**
 * Where in the console a reported target opens. A comment opens its video's thread, and a comment
 * target that names no video has nowhere to go.
 */
export function targetHref(targetType: ReportTargetType, targetId: string): string | null {
  if (targetType === "USER") return `/users/${targetId}`;
  if (targetType === "VIDEO") return `/videos/${targetId}`;
  const comment = parseCommentTarget(targetId);
  return comment ? `/comments?videoId=${encodeURIComponent(comment.videoId)}` : null;
}

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
 * Action types with a live downstream consumer: video-service
 * (takedown/restore/purge), auth-service (ban/unban, signing an account out),
 * interaction-service (comment removal) and notification-service (warnings,
 * delivered to the account, the video's owner or the comment's author). The one
 * left out is DISMISS_REPORT, which admin-service records and never publishes.
 */
export const ENFORCED: ModerationActionType[] = [
  "TAKEDOWN_VIDEO",
  "RESTORE_VIDEO",
  "PURGE_VIDEO",
  "BAN_USER",
  "UNBAN_USER",
  "REMOVE_COMMENT",
  "WARN_USER",
  "REVOKE_SESSIONS",
];

/** The decisions an admin can start from a directory row or a target's own page. */
export type EnforcementAction =
  | "ban"
  | "unban"
  | "warn"
  | "revokeSessions"
  | "takedown"
  | "restore"
  | "approve"
  | "reject";

/** The decision a video's state offers — what its row and its own page put on the button. */
export type VideoDecision = Extract<EnforcementAction, "takedown" | "restore" | "approve">;

/**
 * Approving a video automatic moderation held back and restoring one that was removed are the
 * same write — both go out as VideoRestoredEvent and put it back up. They are not the same
 * decision to the person making it, though: "Restore" on a video nobody ever took down reads as
 * undoing something that never happened.
 */
export function videoDecision(status: VideoStatus): VideoDecision {
  if (status === "PENDING_REVIEW") return "approve";
  if (status === "TAKEN_DOWN" || status === "REJECTED") return "restore";
  return "takedown";
}

/**
 * Every decision a video's own page and the review screen offer. A held video is the one with two
 * answers: approve it, or reject it — a takedown on the wire, named for what it is to someone
 * deciding a video nobody has seen yet. The directory row keeps the single primary decision.
 */
export function videoDecisions(status: VideoStatus): readonly EnforcementAction[] {
  return status === "PENDING_REVIEW" ? ["approve", "reject"] : [videoDecision(status)];
}

/**
 * How long a ban lasts. "Permanent" is first and is the default: a ban with no end is what every
 * ban was until auth-service learned to lift them, and picking a duration should be a decision
 * rather than the thing that happens when nobody chose.
 *
 * One list for a target's own page and for resolving a report, so a ban decided from either
 * offers the same choices.
 */
export const BAN_DURATIONS = [
  { value: "permanent", label: "Permanent" },
  { value: "1", label: "1 day" },
  { value: "3", label: "3 days" },
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
] as const;

export type BanDuration = (typeof BAN_DURATIONS)[number]["value"];

/** The `banDays` admin-service takes: null for a permanent ban. */
export function banDaysOf(duration: BanDuration): number | null {
  return duration === "permanent" ? null : Number(duration);
}

const CONTENT_VIOLATIONS = [
  "Sexual or nude content",
  "Graphic violence",
  "Hate speech or harassment",
  "Dangerous act likely to be imitated",
  "Spam or scam",
  "Copyright infringement",
  "Harmful misinformation",
  "Involves a minor",
] as const;

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
export const PRESET_REASONS: Record<
  EnforcementAction | "removeComment" | "purge",
  readonly string[]
> = {
  purge: [
    "Reviewed — nothing left to keep",
    "Owner asked for permanent erasure",
    "Contains personal data — erase now",
    "Illegal content — erase now",
  ],
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
  warn: [
    "Repeated rule-breaking comments",
    "Harassing another account",
    "Spammy or misleading posts",
    "Last warning before a ban",
  ],
  revokeSessions: [
    "Account reported as taken over",
    "Owner reported a lost or stolen device",
    "Sign-ins the owner does not recognise",
    "Signed in from a shared or public device",
  ],
  takedown: CONTENT_VIOLATIONS,
  // The same violations: a rejection is a takedown of a video that never went live, and the audit
  // log should not grow a second vocabulary for it.
  reject: CONTENT_VIOLATIONS,
  restore: [
    "Reviewed — automatic flag was wrong",
    "Appeal upheld — no violation",
    "Taken down in error",
    "Reviewed again, within policy",
    "Rights holder withdrew the claim",
  ],
  approve: [
    "Reviewed — within policy",
    "Reviewed — automatic flag was wrong",
    "Acceptable in context (news, education, art)",
    "Borderline — allowed, account worth watching",
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
