import "server-only";

import { listReportQueue } from "./reports";
import { referenceNow } from "./shared";
import { listUsers } from "./users";
import { listVideos } from "./videos";
import { memoizeFor } from "@/lib/memo";
import { buildNotifications, type AdminNotification } from "@/lib/notifications";

const NOTIFICATIONS_TTL_MS = 30_000;

/**
 * The bell's feed. Only the first page of each source — the bell is a nudge that links to the
 * full listing, not a second copy of it. The trash reads soonest-to-expire first, so its first
 * page holds every video close enough to the purge to mention. Sign-ups and uploads are counted
 * rather than listed, so they read a longer page, newest first; past 50 in a day the bell says 50+.
 *
 * Kept for {@link NOTIFICATIONS_TTL_MS} and shared by every admin. The layout renders it, and the
 * live stream re-renders the layout up to once a second during a burst of events — five gateway
 * calls each time, two of them 50-row pages. Nothing in the feed is per-admin (unread is, and
 * that is a cookie), so one copy serves them all; the cost is a bell up to that long behind.
 */
export const getNotifications = memoizeFor(NOTIFICATIONS_TTL_MS, () => loadNotifications(10, 20));

/**
 * The notification centre's feed: the bell's sources read further — fifty of each rather than ten
 * — and not cut to the bell's twenty. Cached apart from the bell's copy, which every page renders,
 * so the bell stays the cheap one.
 */
export const getNotificationCenter = memoizeFor(NOTIFICATIONS_TTL_MS, () =>
  loadNotifications(50, 200),
);

async function loadNotifications(size: number, limit: number): Promise<AdminNotification[]> {
  const [queue, review, trash, signups, uploads] = await Promise.all([
    listReportQueue({ size }),
    listVideos({ status: "PENDING_REVIEW", deleted: false, size }),
    listVideos({ deleted: true, purged: false, sort: "deletedAt,asc", size }),
    listUsers({ size: 50 }),
    listVideos({ deleted: false, size: 50 }),
  ]);
  return buildNotifications({
    queue: queue.content,
    review: review.content,
    trash: trash.content,
    signups,
    uploads,
    now: referenceNow(),
    limit,
  });
}
