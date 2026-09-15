"use server";

import { revalidatePath } from "next/cache";
import {
  getComments,
  getUserProfiles,
  listCommentReplies,
  listComments,
  removeComment,
} from "@/lib/api/admin";
import type {
  AdminCommentFilter,
  AdminCommentPage,
  AdminCommentResponse,
  UserProfileResponse,
} from "@/lib/api/types";

export interface ModerationResult {
  ok: boolean;
  message: string;
}

/**
 * A page of comments with everything needed to read it: interaction-service stores ids only, so
 * without the two lookups beside it a reply renders as "#32383488 replying to #2252800".
 */
export interface CommentPageView {
  items: AdminCommentResponse[];
  /** userId → profile, for the authors on the page and the users their replies point at. */
  authors: Record<string, UserProfileResponse>;
  /**
   * commentId → the comment a reply on this page answers. The Replies and Removed views are flat,
   * so the parent is usually not on the page beside its reply. May be missing an id: a parent
   * older than what is loaded still resolves, but one whose row is gone does not.
   */
  parents: Record<string, AdminCommentResponse>;
  nextCursor: string | null;
  hasMore: boolean;
}

/**
 * Fills a raw page out with its authors and parent comments. Both lookups are best-effort — a row
 * falls back to the bare id rather than failing the page, because the thing being moderated is the
 * comment text and it is already in hand.
 */
export async function decoratePage(
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

/** The next page of the listing, for the Load more button. */
export async function loadCommentsAction(
  videoId: string,
  filter: AdminCommentFilter,
  cursor: string,
): Promise<CommentPageView> {
  return decoratePage(videoId, await listComments(videoId, { filter, cursor }));
}

/**
 * One comment's replies, a few at a time. Fetched on expand rather than with the thread: a comment
 * with two hundred replies would otherwise land all of them in the page of top-level comments.
 */
export async function loadRepliesAction(
  videoId: string,
  commentId: string,
  cursor: string | null,
): Promise<CommentPageView> {
  return decoratePage(videoId, await listCommentReplies(videoId, commentId, cursor));
}

/**
 * The comment does not disappear the moment this returns. admin-service writes an outbox row, the
 * dispatcher publishes it, and interaction-service applies the soft delete when it consumes
 * admin.moderation-events — so the revalidated page can still list the comment for a beat. Saying
 * so beats a spinner that lies.
 */
export async function removeCommentAction(
  videoId: string,
  commentId: string,
  reason: string,
): Promise<ModerationResult> {
  if (!reason.trim()) {
    return { ok: false, message: "A reason is required — it goes into the audit log." };
  }

  try {
    await removeComment(videoId, commentId, reason.trim());
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }

  revalidatePath("/comments");
  return {
    ok: true,
    message:
      "Removal recorded. The comment leaves the thread once interaction-service consumes the event, and the video's comment count drops with it.",
  };
}
