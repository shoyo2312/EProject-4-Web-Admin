import type {
  CaptionField,
  ModerationActionType,
  ModerationSummary,
  ReportStatus,
  TextCategory,
  UserStatus,
  VideoStatus,
} from "@/lib/api/types";
import type { NotificationKind } from "@/lib/notifications";

/**
 * What each state is called on screen. The enum names are the API's vocabulary — TAKEN_DOWN,
 * PENDING_REVIEW — and a moderator scanning a table should not have to read them as code.
 * One map per enum, so a status reads the same on a badge, in a search result and in a sentence.
 */
export const VIDEO_STATUS_LABELS: Record<VideoStatus, string> = {
  PROCESSING: "Processing",
  PENDING_MODERATION: "Being checked",
  PENDING_REVIEW: "Needs review",
  PUBLISHED: "Published",
  FAILED: "Failed",
  REJECTED: "Auto-removed",
  TAKEN_DOWN: "Taken down",
};

export const USER_STATUS_LABELS: Record<UserStatus, string> = {
  ACTIVE: "Active",
  LOCKED: "Locked",
  BANNED: "Banned",
};

export const REPORT_STATUS_LABELS: Record<ReportStatus, string> = {
  PENDING: "Pending",
  RESOLVED: "Resolved",
  DISMISSED: "Dismissed",
};

/**
 * A directory's status tabs: "All", then the given statuses by the names above, so a tab reads
 * the same as the badge on every row it selects. The order is the caller's, because which status
 * comes first is a decision about that list.
 */
export function statusTabs<T extends string>(
  order: readonly T[],
  labels: Record<T, string>,
): { value: T | "ALL"; label: string }[] {
  return [{ value: "ALL", label: "All" }, ...order.map((value) => ({ value, label: labels[value] }))];
}

/** What the classifier decided, which an admin's later decision does not rewrite. */
export const MODERATION_VERDICT_LABELS: Record<ModerationSummary["verdict"], string> = {
  APPROVED: "Passed",
  REVIEW: "Held for review",
  REJECTED: "Auto-removed",
};

/** What text moderation files a flag under, as a moderator reads it on a comment or a caption. */
export const TEXT_CATEGORY_LABELS: Record<TextCategory, string> = {
  PROFANITY: "Profanity",
  INSULT: "Insult",
  HATE: "Hate",
  SEXUAL: "Sexual",
  VIOLENCE: "Violence",
  SCAM: "Scam",
  SPAM: "Spam",
  PERSONAL_INFO: "Personal info",
  CREATOR_FILTER: "Creator's filter",
};

/**
 * A category by name. Flags arrive as text, so one the moderation side adds before this console
 * knows it is shown as its own name rather than as nothing.
 */
export function categoryLabel(category: string): string {
  return (TEXT_CATEGORY_LABELS as Record<string, string | undefined>)[category] ?? category;
}

export const CAPTION_FIELD_LABELS: Record<CaptionField, string> = {
  TITLE: "Title",
  DESCRIPTION: "Description",
  TAGS: "Tags",
};

/**
 * Past tense, because the audit log is a record of what was done. An approved held video is a
 * RESTORE_VIDEO too — both put the video back through the same event — so "restored" covers it,
 * as "took down" covers a rejected one.
 */
export const ACTION_LABELS: Record<ModerationActionType, string> = {
  BAN_USER: "Banned account",
  UNBAN_USER: "Unbanned account",
  WARN_USER: "Warned account",
  REVOKE_SESSIONS: "Signed account out",
  TAKEDOWN_VIDEO: "Took down video",
  RESTORE_VIDEO: "Restored video",
  PURGE_VIDEO: "Deleted video permanently",
  REMOVE_COMMENT: "Removed comment",
  DISMISS_REPORT: "Dismissed report",
};

/** The notification centre's filter, one name per kind of thing the feed is built from. */
export const NOTIFICATION_KIND_LABELS: Record<NotificationKind, string> = {
  report: "Reports",
  review: "Held videos",
  trash: "Trash",
  signup: "Sign-ups",
  upload: "Uploads",
};
