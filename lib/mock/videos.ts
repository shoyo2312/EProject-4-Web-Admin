import type {
  AdminVideoResponse,
  ModerationSummary,
  VideoStatus,
  VideoVisibility,
} from "@/lib/api/types";
import { MOCK_NOW, between, pick, seededRandom } from "./random";

const TITLES = [
  "Morning routine that actually works", "3am ramen run", "Rebuilding my desk setup",
  "Street food tour — District 1", "Why my code compiles at 4am", "Cat judges my cooking",
  "First time bouldering", "Hanoi to Sapa by night train", "Unboxing a 2007 iPod",
  "Learning bass in 30 days", "The cheapest coffee in town", "Repainting a thrifted chair",
  "Sunrise from the 40th floor", "How I edit in under 10 minutes", "Nobody talks about this",
] as const;

const TAGS = ["food", "travel", "coding", "diy", "music", "fitness", "vlog", "review"] as const;

/** Weighted: most uploads are live, a few are stuck or removed. */
const STATUSES: VideoStatus[] = [
  "PUBLISHED", "PUBLISHED", "PUBLISHED", "PUBLISHED", "PUBLISHED",
  "PROCESSING", "TAKEN_DOWN", "FAILED",
];

const VISIBILITIES: VideoVisibility[] = ["PUBLIC", "PUBLIC", "PUBLIC", "FRIENDS", "PRIVATE"];

/** Written the way a moderator writes them — the presets in VideosTable, not category labels. */
const TAKEDOWN_REASONS = [
  "Sexual or nude content",
  "Graphic violence",
  "Spam or scam",
  "Copyright infringement",
] as const;

const DAY_MS = 24 * 60 * 60_000;

/**
 * What the classifier left on a video, which is what the reason column falls back to. Covers the
 * three shapes the table has to render: a confident removal, a held video the model was unsure
 * about, and one where the check never ran — that last one carries no scores at all, only a reason,
 * and is the case a fixture built from the happy path would quietly leave untested.
 */
function moderationFor(status: VideoStatus, i: number, checkedAt: string): ModerationSummary | null {
  const base = {
    label: "nsfw",
    model: "Falconsai/nsfw_image_detection",
    modelVersion: "nsfw-v1",
    reason: null,
    checkedAt,
  };
  switch (status) {
    case "PROCESSING":
    case "PENDING_MODERATION":
    case "FAILED":
      // Nothing has scored it yet.
      return null;
    case "REJECTED":
      return { ...base, verdict: "REJECTED", maxScore: 0.94, suspiciousFrames: 4, totalFrames: 10 };
    case "PENDING_REVIEW":
      return i % 4 === 0
        ? {
            ...base,
            verdict: "REVIEW",
            label: null,
            maxScore: 0,
            suspiciousFrames: 0,
            totalFrames: 0,
            model: null,
            modelVersion: null,
            reason:
              "Automatic moderation could not be completed after 3 attempts (connection refused)",
          }
        : { ...base, verdict: "REVIEW", maxScore: 0.72, suspiciousFrames: 2, totalFrames: 10 };
    default:
      // Published, or taken down by hand after being published — the model let it through.
      return { ...base, verdict: "APPROVED", maxScore: 0.04, suspiciousFrames: 0, totalFrames: 10 };
  }
}

/**
 * 48 uploads, seeded so server render and client hydration agree. Shapes a naive fixture would
 * miss but the real data has: a FAILED video carrying its failure reason, a PROCESSING one with
 * no playable url or duration yet, and one with comments off, which the API answers with a null
 * comment total rather than a zero.
 */
export const mockVideos: AdminVideoResponse[] = (() => {
  const rand = seededRandom(20260906);
  return Array.from({ length: 48 }, (_, i) => {
    const status = i === 0 ? "PUBLISHED" : pick(rand, STATUSES);
    const ready = status === "PUBLISHED" || status === "TAKEN_DOWN";
    const commentsDisabled = i % 9 === 4;
    const createdAt = new Date(MOCK_NOW - between(rand, 1, 240) * DAY_MS).toISOString();
    const views = ready ? between(rand, 120, 480_000) : 0;

    return {
      id: String(7_310_000_000_000_000_000n + BigInt(i * 2048)),
      userId: String(7_300_000_000_000_000_000n + BigInt(between(rand, 0, 59) * 4096)),
      title: `${pick(rand, TITLES)}${i > TITLES.length ? ` #${i}` : ""}`,
      description: i % 5 === 0 ? null : "Shot on a phone, edited on a train.",
      thumbnailUrl: ready ? `https://cdn.example.com/thumbs/${i}.jpg` : null,
      previewUrl: null,
      hlsUrl: ready ? `https://cdn.example.com/hls/${i}/master.m3u8` : null,
      durationSeconds: ready ? between(rand, 8, 180) : null,
      status,
      visibility: pick(rand, VISIBILITIES),
      viewCount: views,
      likeCount: Math.round(views * (between(rand, 3, 14) / 100)),
      commentCount: commentsDisabled ? null : Math.round(views / between(rand, 40, 200)),
      commentsDisabled,
      tags: [pick(rand, TAGS), pick(rand, TAGS)].filter((t, j, all) => all.indexOf(t) === j),
      createdAt,
      updatedAt: new Date(MOCK_NOW - between(rand, 0, 20) * DAY_MS).toISOString(),
      publishedAt: ready
        ? new Date(MOCK_NOW - between(rand, 0, 230) * DAY_MS).toISOString()
        : null,
      rawFileUrl: `s3://tiktok-raw/${i}/source.mp4`,
      failureReason:
        status === "FAILED" ? "ffmpeg: moov atom not found — upload truncated" : null,
      takedownReason: status === "TAKEN_DOWN" ? pick(rand, TAKEDOWN_REASONS) : null,
      // The fixtures stand in for the admin listing, which never returns a deleted video.
      deletedAt: null,
      moderation: moderationFor(status, i, createdAt),
    };
  }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
})();
