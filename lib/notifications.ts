import type { AdminVideoResponse, ReportGroupResponse } from "@/lib/api/types";

/**
 * The topbar bell's feed: the things waiting on an admin, derived from listings the console
 * already reads rather than from a notification store — nothing on the backend records "an admin
 * has been told". ponytail: derived, so a report group that gets resolved simply drops out; add a
 * stored feed (admin-service consuming events) only when something must be announced that no
 * listing can show, e.g. an automatic purge — see docs/KIEN-TRUC.md, "Thùng rác".
 */

export type NotificationKind = "report" | "review" | "trash";

export interface AdminNotification {
  id: string;
  /** ISO 8601 — when this became something to look at. Drives both order and unread. */
  at: string;
  kind: NotificationKind;
  title: string;
  detail: string;
  href: string;
}

const DAY_MS = 86_400_000;
/** Mirrors video-service's `video.trash.retention`. */
export const TRASH_RETENTION_DAYS = 30;
/** How close to the purge a trashed video has to be before the bell mentions it. */
export const TRASH_WARNING_DAYS = 3;

function reportHref(group: ReportGroupResponse): string {
  if (group.targetType === "VIDEO") return `/videos/${group.targetId}`;
  if (group.targetType === "USER") return `/users/${group.targetId}`;
  return "/moderation/reports";
}

export function buildNotifications(input: {
  queue: ReportGroupResponse[];
  review: AdminVideoResponse[];
  trash: AdminVideoResponse[];
  now: number;
  limit?: number;
}): AdminNotification[] {
  const { queue, review, trash, now, limit = 20 } = input;

  const reports = queue.map<AdminNotification>((group) => ({
    id: `report:${group.targetType}:${group.targetId}`,
    at: group.lastReportedAt,
    kind: "report",
    title: `${group.reportCount} ${group.reportCount === 1 ? "report" : "reports"} on a ${group.targetType.toLowerCase()}`,
    detail: group.latestReason,
    href: reportHref(group),
  }));

  const reviews = review.map<AdminNotification>((video) => ({
    id: `review:${video.id}`,
    at: video.moderation?.checkedAt ?? video.updatedAt,
    kind: "review",
    title: "Video waiting for review",
    detail: video.title,
    href: `/videos/${video.id}`,
  }));

  const expiring = trash.flatMap<AdminNotification>((video) => {
    if (!video.deletedAt) return [];
    const warnFrom =
      Date.parse(video.deletedAt) + (TRASH_RETENTION_DAYS - TRASH_WARNING_DAYS) * DAY_MS;
    if (now < warnFrom) return [];
    return [{
      id: `trash:${video.id}`,
      at: new Date(warnFrom).toISOString(),
      kind: "trash",
      title: "Trashed video erased soon",
      detail: video.title,
      href: "/trash",
    }];
  });

  return [...reports, ...reviews, ...expiring]
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    .slice(0, limit);
}

/** Unread is "newer than the newest item the admin had seen when they last opened the bell". */
export function countUnread(items: AdminNotification[], seenAt: number): number {
  return items.filter((item) => Date.parse(item.at) > seenAt).length;
}

/** What to store as seen on open: the feed's own newest timestamp, so clock skew can't matter. */
export function newestAt(items: AdminNotification[]): number {
  return items.reduce((max, item) => Math.max(max, Date.parse(item.at)), 0);
}
