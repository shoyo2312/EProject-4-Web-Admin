import type { AdminCommentResponse, UserProfileResponse } from "@/lib/api/types";
import type { VideoSummary } from "@/lib/names";

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
 * The reported comments a worklist shows, read back from their threads, keyed by comment id. A
 * comment with no entry could not be read: the report is still there to decide.
 */
export interface ReportedCommentDetails {
  comments: Record<string, AdminCommentResponse>;
  authors: Record<string, UserProfileResponse>;
  videos: Record<string, VideoSummary>;
}

/**
 * Keeps asking until a page has something in it, or there is nothing left to ask for.
 *
 * interaction-service filters the Replies, Removed and Held views after Cassandra has cut the page,
 * and gives up on one request after a bounded scan with an empty page and a cursor. So an empty page
 * with more behind it says nothing about the video: read as "none", it told an admin nothing had
 * been removed from a video where something had. Bounded here too, because a very long thread with
 * no match would otherwise be every row of it read in one render. What comes back after `maxPages`
 * can still be empty with more behind it, and the screen has to say so.
 */
export async function firstPageWithItems<
  P extends { items: readonly unknown[]; nextCursor: string | null; hasMore: boolean },
>(fetchPage: (cursor: string | null) => Promise<P>, cursor: string | null, maxPages: number): Promise<P> {
  let page = await fetchPage(cursor);
  for (let asked = 1; asked < maxPages && page.items.length === 0 && page.nextCursor; asked += 1) {
    page = await fetchPage(page.nextCursor);
  }
  return page;
}

/** Appends a freshly-loaded page to what is already on screen. */
export function appendPage(current: CommentPageView, next: CommentPageView): CommentPageView {
  return {
    items: [...current.items, ...next.items],
    authors: { ...current.authors, ...next.authors },
    parents: { ...current.parents, ...next.parents },
    nextCursor: next.nextCursor,
    hasMore: next.hasMore,
  };
}

/**
 * Lays a re-rendered first page over what is on screen. The rows it carries are replaced, comments
 * newer than any on screen land on top, and everything paged in below it stays, with the cursor
 * that continues after it. The server re-renders the first page on every refresh — the live
 * stream fires one on any admin event — and starting the thread over each time threw away what
 * the admin had loaded with Load more.
 *
 * Every view keeps removed comments, so a row leaves the first page only by being pushed down by
 * newer ones, and then it is still here, below them.
 */
export function refreshFirstPage(view: CommentPageView, first: CommentPageView): CommentPageView {
  const onFirst = new Set(first.items.map((c) => c.commentId));
  const below = view.items.filter((c) => !onFirst.has(c.commentId));
  return {
    items: [...first.items, ...below],
    authors: { ...view.authors, ...first.authors },
    parents: { ...view.parents, ...first.parents },
    nextCursor: below.length > 0 ? view.nextCursor : first.nextCursor,
    hasMore: below.length > 0 ? view.hasMore : first.hasMore,
  };
}
