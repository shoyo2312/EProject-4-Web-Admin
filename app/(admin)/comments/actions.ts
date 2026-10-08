"use server";

import { revalidatePath } from "next/cache";
import {
  decorateCommentPage,
  getComments,
  listCommentReplies,
  listComments,
  removeComment,
} from "@/lib/api/comments";
import type { AdminCommentFilter } from "@/lib/api/types";
import type { CommentPageView } from "@/lib/comments";
import type { ModerationResult } from "@/lib/moderation";

/** The next page of the listing, for the Load more button. */
export async function loadCommentsAction(
  videoId: string,
  filter: AdminCommentFilter,
  cursor: string,
): Promise<CommentPageView> {
  return decorateCommentPage(videoId, await listComments(videoId, { filter, cursor }));
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
  return decorateCommentPage(videoId, await listCommentReplies(videoId, commentId, cursor));
}

/**
 * Whether a comment is removed yet, read by id. For the rows a page refresh does not reach: the
 * comments paged in with Load more and the replies in an opened thread are client state.
 */
export async function commentRemovedAction(videoId: string, commentId: string): Promise<boolean> {
  const [comment] = await getComments(videoId, [commentId]);
  return Boolean(comment?.deletedAt);
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
