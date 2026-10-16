import "server-only";

import { apiGet, apiPost } from "./client";
import { USE_MOCK } from "./config";
import { getUserProfiles } from "./names";
import type {
  AdminCommentFilter,
  AdminCommentPage,
  AdminCommentResponse,
  ModerationActionResponse,
} from "./types";
import type { CommentPageView } from "@/lib/comments";
import { mockCommentPage, mockCommentsByIds, mockReplyPage } from "@/lib/mock/comments";

/**
 * How many comments one page holds, and how many replies one "View replies" click pulls down.
 * The reply page is small on purpose — the same three-at-a-time reveal the viewer-facing panel
 * uses, so opening a thread of two hundred does not land two hundred rows in the console.
 */
export const COMMENT_PAGE_SIZE = 20;
export const REPLY_PAGE_SIZE = 3;

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
  const { filter = "THREAD", cursor, size = COMMENT_PAGE_SIZE } = options;
  if (USE_MOCK) return mockCommentPage(videoId, filter, cursor ?? null, size);

  const params = new URLSearchParams({ filter, size: String(size) });
  if (cursor) params.set("cursor", cursor);
  return apiGet<AdminCommentPage>(
    `/api/v1/interactions/admin/videos/${videoId}/comments?${params}`,
  );
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
    `/api/v1/interactions/admin/videos/${videoId}/comments/by-ids?${params}`,
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
