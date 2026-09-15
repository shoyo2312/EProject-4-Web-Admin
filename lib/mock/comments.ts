import type {
  AdminCommentFilter,
  AdminCommentPage,
  AdminCommentResponse,
} from "@/lib/api/types";
import { between, pick, seededRandom } from "./random";

const BODIES = [
  "this is actually so useful thank you",
  "no way that worked first try",
  "where did you get the desk?",
  "i tried this and burned everything 😭",
  "the transition at 0:14 is clean",
  "algorithm finally showing me good stuff",
  "second one is better imo",
  "how long did the edit take",
  "coming back to this every week",
  "bro is speedrunning life",
  "the cat stole the whole video",
  "link to the song?",
  "buy followers cheap dm me now 🔥🔥 www.example-spam.test",
  "you have no idea what you're talking about, delete this",
  "made it last night, family loved it",
  "wait this is in my city",
] as const;

/** Weighted so most threads read as real ones: a few replies, the odd removed row. */
const DAY_MS = 24 * 60 * 60_000;

/**
 * Comments for one video, seeded off its id so the same video always produces the same thread —
 * server render and client hydration have to agree, and paging back to a video must not reshuffle
 * what the admin was just looking at.
 *
 * Deliberately includes the shapes moderation actually meets: a spam comment, a hostile one, a row
 * already removed, and replies pointing at a parent.
 */
/**
 * Comments for one video, seeded off its id so the same video always produces the same thread —
 * server render and client hydration have to agree, and paging back to a video must not reshuffle
 * what the admin was just looking at.
 *
 * Deliberately includes the shapes moderation actually meets: a spam comment, a hostile one, a row
 * already removed, and replies pointing at a parent. Long enough to page through, so the Load more
 * path is exercised without the live backend.
 */
function thread(videoId: string): AdminCommentResponse[] {
  const rand = seededRandom(Number(videoId.slice(-7)) || 1);
  const count = between(rand, 24, 64);
  const base = Date.parse("2026-08-13T09:00:00Z") - between(rand, 1, 20) * DAY_MS;

  const built: AdminCommentResponse[] = [];
  for (let i = 0; i < count; i += 1) {
    const parent = i > 2 && rand() < 0.35 ? built[between(rand, 0, i - 1)] : null;
    // A reply to a reply flattens onto that reply's own parent — one level deep, as the
    // service enforces — and only then is replyToUserId set.
    const parentId = parent ? (parent.parentId ?? parent.commentId) : null;
    const replyToUserId = parent?.parentId ? parent.userId : null;

    built.push({
      commentId: String(7_320_000_000_000_000_000n + BigInt(i * 512)),
      videoId,
      userId: String(7_300_000_000_000_000_000n + BigInt(between(rand, 0, 59) * 4096)),
      content: pick(rand, BODIES),
      parentId,
      replyToUserId,
      likeCount: rand() < 0.6 ? between(rand, 0, 340) : 0,
      // Filled in below, once the whole thread is known.
      replyCount: 0,
      hasReplies: false,
      createdAt: new Date(base + i * between(rand, 60_000, 4 * 3_600_000)).toISOString(),
      deletedAt: rand() < 0.12 ? new Date(base + (i + 1) * 3_600_000).toISOString() : null,
    });
  }

  // The same two numbers the service derives: the counter counts live replies only, while the
  // index row behind a removed reply stays — so a thread can read 0 and still have replies.
  for (const comment of built) {
    const replies = built.filter((c) => c.parentId === comment.commentId);
    comment.replyCount = replies.filter((c) => c.deletedAt === null).length;
    comment.hasReplies = replies.length > 0;
  }

  // Newest first, matching the clustering order Cassandra returns them in.
  return built.reverse();
}

/**
 * The cursor, for mock purposes only, is how many rows of the filtered list have been handed out.
 * The real one is Cassandra's paging state and is never parsed — which is the point of keeping
 * this opaque here too.
 */
function slice(rows: AdminCommentResponse[], cursor: string | null, size: number): AdminCommentPage {
  const from = Number(cursor) || 0;
  const items = rows.slice(from, from + size);
  const hasMore = from + size < rows.length;
  return { items, nextCursor: hasMore ? String(from + size) : null, hasMore };
}

export function mockCommentPage(
  videoId: string,
  filter: AdminCommentFilter,
  cursor: string | null,
  size: number,
): AdminCommentPage {
  const all = thread(videoId);
  const rows =
    filter === "THREAD"
      ? all.filter((c) => c.parentId === null)
      : filter === "REPLIES"
        ? all.filter((c) => c.parentId !== null)
        : all.filter((c) => c.deletedAt !== null);
  return slice(rows, cursor, size);
}

/** One comment's replies, oldest first — the order the conversation happened in. */
export function mockReplyPage(
  videoId: string,
  commentId: string,
  cursor: string | null,
  size: number,
): AdminCommentPage {
  const replies = thread(videoId)
    .filter((c) => c.parentId === commentId)
    .reverse();
  return slice(replies, cursor, size);
}

export function mockCommentsByIds(videoId: string, ids: string[]): AdminCommentResponse[] {
  const wanted = new Set(ids);
  return thread(videoId).filter((c) => wanted.has(c.commentId));
}
