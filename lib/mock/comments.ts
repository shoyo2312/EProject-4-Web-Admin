import type { AdminCommentResponse } from "@/lib/api/types";
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
export function mockComments(videoId: string, size: number): AdminCommentResponse[] {
  const rand = seededRandom(Number(videoId.slice(-7)) || 1);
  const count = Math.min(size, between(rand, 4, 26));
  const base = Date.parse("2026-08-13T09:00:00Z") - between(rand, 1, 20) * DAY_MS;

  const thread: AdminCommentResponse[] = [];
  for (let i = 0; i < count; i += 1) {
    const parent = i > 2 && rand() < 0.35 ? thread[between(rand, 0, i - 1)] : null;
    // A reply to a reply flattens onto that reply's own parent — one level deep, as the
    // service enforces — and only then is replyToUserId set.
    const parentId = parent ? (parent.parentId ?? parent.commentId) : null;
    const replyToUserId = parent?.parentId ? parent.userId : null;

    thread.push({
      commentId: String(7_320_000_000_000_000_000n + BigInt(i * 512)),
      videoId,
      userId: String(7_300_000_000_000_000_000n + BigInt(between(rand, 0, 59) * 4096)),
      content: pick(rand, BODIES),
      parentId,
      replyToUserId,
      likeCount: rand() < 0.6 ? between(rand, 0, 340) : 0,
      createdAt: new Date(base + i * between(rand, 60_000, 4 * 3_600_000)).toISOString(),
      deletedAt: rand() < 0.12 ? new Date(base + (i + 1) * 3_600_000).toISOString() : null,
    });
  }

  // Newest first, matching the clustering order Cassandra returns them in.
  return thread.reverse();
}
