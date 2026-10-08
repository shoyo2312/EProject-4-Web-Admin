import type {
  ModerationActionType,
  ReportStatus,
  UserStatus,
  VideoStatus,
} from "@/lib/api/types";

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
 * Past tense, because the audit log is a record of what was done. An approved held video is a
 * RESTORE_VIDEO too — both put the video back through the same event — so "restored" covers it.
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
