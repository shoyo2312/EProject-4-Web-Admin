import type { ModerationSettingsResponse, ModerationSummary } from "@/lib/api/types";

/**
 * The classifier's cut points, as far as the settings endpoint reports them. The payload is
 * moderation-service's environment passed through as a loose map, so a value it leaves out is null
 * here rather than a line drawn at zero.
 */
export interface ReviewLines {
  reviewAt: number;
  rejectAt: number;
  minRejectFrames: number | null;
}

/** The lines in force, or null when moderation-service did not answer or left them out. */
export function reviewLines(settings: ModerationSettingsResponse | null): ReviewLines | null {
  if (!settings?.reachable) return null;
  const { reviewAt, rejectAt, minRejectFrames } = settings.values;
  if (typeof reviewAt !== "number" || typeof rejectAt !== "number") return null;
  return {
    reviewAt,
    rejectAt,
    minRejectFrames: typeof minRejectFrames === "number" ? minRejectFrames : null,
  };
}

/**
 * Why automatic moderation held a video for a person, in the classifier's own terms. The rule is
 * moderation-service's verdict.py: under the review line it publishes, past the reject line with
 * enough frames past the review line it removes, and everything between waits for a moderator. A
 * check that could not finish is held too — no evidence is not an approval.
 *
 * Measured against today's lines, which can have moved since the video was checked; the last
 * branch is the one place that shows.
 */
export function heldBecause(
  moderation: ModerationSummary | null,
  lines: ReviewLines | null,
): string {
  if (!moderation) return "No classifier result is stored for this video.";
  if (moderation.reason) return `The check did not finish: ${moderation.reason}`;
  if (moderation.totalFrames === 0) {
    return "No frame could be sampled from the file, so there was nothing to score.";
  }
  if (!lines) {
    return "Held for a person to decide. The classifier's thresholds could not be read to say why.";
  }

  const score = moderation.maxScore.toFixed(2);
  const reviewAt = lines.reviewAt.toFixed(2);
  const rejectAt = lines.rejectAt.toFixed(2);
  if (moderation.maxScore >= lines.rejectAt) {
    const frames = moderation.suspiciousFrames;
    const needed = lines.minRejectFrames;
    if (needed !== null && frames < needed) {
      return `Its highest frame scored ${score}, past the reject line (${rejectAt}), but only ${frames} ${frames === 1 ? "frame" : "frames"} reached the review line — an automatic removal needs ${needed}.`;
    }
    return `Its highest frame scored ${score}, past the reject line (${rejectAt}).`;
  }
  if (moderation.maxScore >= lines.reviewAt) {
    return `Its highest frame scored ${score}: past the review line (${reviewAt}), short of the reject line (${rejectAt}).`;
  }
  return `Its highest frame scored ${score}, under today's review line (${reviewAt}) — the line was lower when it was checked.`;
}

/**
 * What to show in place of a score for a check that scored no frame, or null when it has one.
 * Moderation switched off, a check that could not finish, a file with no frame to sample and a
 * verdict that never arrived all store 0.000 on 0 of 0 frames, and shown as figures those read as
 * a clean pass. The reason is the backend's own sentence (media-worker's or the stuck-video
 * sweeper's), shown as written.
 */
export function unscoredBecause(moderation: ModerationSummary): string | null {
  if (moderation.totalFrames > 0) return null;
  const why = (moderation.reason ?? "No frame could be sampled from the video").replace(/\.$/, "");
  switch (moderation.verdict) {
    case "REVIEW":
      return `${why}. A check that cannot finish holds the video for a person rather than passing it.`;
    case "APPROVED":
      return `${why}, so it was passed without a score.`;
    default:
      return `${why}.`;
  }
}

/**
 * Where to go once a video is decided: the next one not yet decided after it, then the first one
 * skipped before it, and -1 when every video in the batch has an answer. `from` may be -1, to
 * start from the top.
 */
export function nextUndecided(
  ids: readonly string[],
  decided: ReadonlySet<string>,
  from: number,
): number {
  for (let i = from + 1; i < ids.length; i++) {
    if (!decided.has(ids[i])) return i;
  }
  for (let i = 0; i <= from && i < ids.length; i++) {
    if (!decided.has(ids[i])) return i;
  }
  return -1;
}

export type ReviewCommand = "next" | "previous" | "approve" | "reject";

/**
 * The review screen's keys: J and K step through the queue the way they step through a list in a
 * mail or feed reader, A approves and R rejects. Nothing while a modifier is held — ⌘R reloads
 * the page and Ctrl+K opens the search — or while typing, where they are letters.
 */
export function reviewCommand(key: string, modified: boolean, typing: boolean): ReviewCommand | null {
  if (modified || typing) return null;
  switch (key.toLowerCase()) {
    case "j":
      return "next";
    case "k":
      return "previous";
    case "a":
      return "approve";
    case "r":
      return "reject";
    default:
      return null;
  }
}
