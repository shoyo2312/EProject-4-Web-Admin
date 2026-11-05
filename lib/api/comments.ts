import "server-only";

import { apiGet, apiPost } from "./client";
import { USE_MOCK } from "./config";
import { getUserProfiles, getVideoSummaries } from "./names";
import type {
  AdminCommentFilter,
  AdminCommentPage,
  AdminCommentResponse,
  ModerationActionResponse,
} from "./types";
import { getVideo } from "./videos";
import { firstPageWithItems, type CommentPageView, type ReportedCommentDetails } from "@/lib/comments";
import { mockCommentPage, mockCommentsByIds, mockReplyPage } from "@/lib/mock/comments";
import type { ReportedComment } from "@/lib/moderation";

/**
 * How many comments one page holds, and how many replies one "View replies" click pulls down.
 * The reply page is small on purpose — the same three-at-a-time reveal the viewer-facing panel
 * uses, so opening a thread of two hundred does not land two hundred rows in the console.
 */
export const COMMENT_PAGE_SIZE = 20;
export const REPLY_PAGE_SIZE = 3;

/**
 * Removed and Held match a handful of rows in a whole thread, and the size asked for is also how
 * much of the thread one request scans (five of it). The service's ceiling reads a video of a few
 * hundred comments in one request, where twenty answered with an empty page and "more behind".
 */
const SPARSE_PAGE_SIZE = 100;
const PAGE_SIZE: Record<AdminCommentFilter, number> = {
  THREAD: COMMENT_PAGE_SIZE,
  REPLIES: COMMENT_PAGE_SIZE,
  REMOVED: SPARSE_PAGE_SIZE,
  HELD: SPARSE_PAGE_SIZE,
};

/** Requests one filtered read may spend looking for its first match, against the gateway's limit. */
const MAX_SCANS = 4;

/**
 * One page of a video's comments, removed ones included. Per video because that is the only shape
 * Cassandra can answer: both tables behind it are partitioned by video id, and a platform-wide
 * "newest comments" listing would need another table written on every comment.
 *
 * Cursor-paged rather than one slab: before this, a thread longer than the page was silently
 * truncated, and an admin had no way to tell. The cursor is opaque — pass back what the last page
 * returned.
 */
export async function listComments(
  videoId: string,
  options: { filter?: AdminCommentFilter; cursor?: string | null; size?: number } = {},
): Promise<AdminCommentPage> {
  const { filter = "THREAD", cursor = null, size = PAGE_SIZE[filter] } = options;
  if (USE_MOCK) return mockCommentPage(videoId, filter, cursor, size);

  const fetchPage = (after: string | null) => {
    const params = new URLSearchParams({ filter, size: String(size) });
    if (after) params.set("cursor", after);
    return apiGet<AdminCommentPage>(
      `/api/v1/interactions/admin/videos/${videoId}/comments?${params}`,
    );
  };
  // The thread reads an index and never comes back empty with more behind it; the others scan.
  return filter === "THREAD" ? fetchPage(cursor) : firstPageWithItems(fetchPage, cursor, MAX_SCANS);
}

/**
 * One comment's replies, oldest first. Split from the listing above, which returns top-level
 * comments only: a thread of two hundred replies is not something every page of comments should
 * carry, and an admin opens one thread at a time.
 */
export async function listCommentReplies(
  videoId: string,
  commentId: string,
  cursor: string | null = null,
  size = REPLY_PAGE_SIZE,
): Promise<AdminCommentPage> {
  if (USE_MOCK) return mockReplyPage(videoId, commentId, cursor, size);

  const params = new URLSearchParams({ size: String(size) });
  if (cursor) params.set("cursor", cursor);
  return apiGet<AdminCommentPage>(
    `/api/v1/interactions/admin/videos/${videoId}/comments/${commentId}/replies?${params}`,
  );
}

/**
 * Specific comments by id. Used for the comment a reply answers: the Replies and Removed views are
 * flat, so the parent is usually not on the page beside its reply. Ids that resolve to nothing are
 * simply absent from the result — the caller renders the reply without a preview.
 */
export async function getComments(
  videoId: string,
  ids: string[],
): Promise<AdminCommentResponse[]> {
  const unique = [...new Set(ids)].filter(Boolean);
  if (unique.length === 0) return [];
  if (USE_MOCK) return mockCommentsByIds(videoId, unique);

  const params = new URLSearchParams({ ids: unique.join(",") });
  return apiGet<AdminCommentResponse[]>(
    `/api/v1/interactions/admin/videos/${encodeURIComponent(videoId)}/comments/by-ids?${params}`,
  );
}

/**
 * Removal goes through admin-service even though interaction-service owns the row: the call
 * writes a moderation_actions row plus an outbox event, and interaction-service applies it from
 * admin.moderation-events. Calling interaction-service directly would delete the comment with
 * nothing in the audit log to say who did it or why.
 *
 * There is no restore counterpart. The soft delete is undone only by interaction-service's own
 * compensation, which is conditioned on the exact deletion it wrote — an unconditional un-delete
 * would resurrect comments other people removed.
 */
export async function removeComment(
  videoId: string,
  commentId: string,
  reason: string,
): Promise<ModerationActionResponse> {
  if (USE_MOCK) {
    throw new Error(
      "Removing a comment requires the live backend (ADMIN_USE_MOCK=false) — it writes an audit row and a Kafka event.",
    );
  }
  return apiPost<ModerationActionResponse>(
    `/api/v1/admin/comments/${videoId}/${commentId}/remove`,
    { reason },
  );
}

/**
 * Fills a raw page out with its authors and parent comments. Both lookups are best-effort — a row
 * falls back to the bare id rather than failing the page, because the thing being moderated is the
 * comment text and it is already in hand.
 */
export async function decorateCommentPage(
  videoId: string,
  page: AdminCommentPage,
): Promise<CommentPageView> {
  const onPage = new Set(page.items.map((c) => c.commentId));
  const missingParents = [
    ...new Set(page.items.flatMap((c) => (c.parentId && !onPage.has(c.parentId) ? [c.parentId] : []))),
  ];

  const parentList = missingParents.length
    ? await getComments(videoId, missingParents).catch(() => [])
    : [];
  const parents = Object.fromEntries(parentList.map((c) => [c.commentId, c]));

  const authors = await getUserProfiles([
    ...page.items.map((c) => c.userId),
    ...page.items.flatMap((c) => c.replyToUserId ?? []),
    ...parentList.map((c) => c.userId),
  ]).catch(() => ({}));

  return { items: page.items, authors, parents, nextCursor: page.nextCursor, hasMore: page.hasMore };
}

/**
 * Reads reported comments back from their threads, for a worklist that shows what is being judged
 * rather than the tail of an id. One request per video, since that is what a comment is partitioned
 * by, so the caller keeps the list short. Best-effort for the same reason as the page above: a
 * report whose comment cannot be read is still there to decide.
 */
export async function getReportedCommentDetails(
  reported: readonly ReportedComment[],
): Promise<ReportedCommentDetails> {
  const byVideo = new Map<string, string[]>();
  for (const { videoId, commentId } of reported) {
    byVideo.set(videoId, [...(byVideo.get(videoId) ?? []), commentId]);
  }

  const found = (
    await Promise.all(
      [...byVideo].map(([videoId, ids]) =>
        getComments(videoId, ids).catch((): AdminCommentResponse[] => []),
      ),
    )
  ).flat();

  const [authors, summaries] = await Promise.all([
    getUserProfiles(found.map((c) => c.userId)).catch(() => ({})),
    getVideoSummaries([...byVideo.keys()]),
  ]);

  // The batch applies the viewer rule, and a video viewers cannot see still has reported comments.
  // The admin route is one call each, so only for those, on a list the caller keeps short.
  const hidden = await Promise.all(
    [...byVideo.keys()]
      .filter((id) => !summaries[id])
      .map((id) => getVideo(id).catch(() => null)),
  );
  const videos = { ...summaries };
  for (const video of hidden) {
    if (video) {
      videos[video.id] = { title: video.title, thumbnailUrl: video.thumbnailUrl, userId: video.userId };
    }
  }

  return { comments: Object.fromEntries(found.map((c) => [c.commentId, c])), authors, videos };
}
