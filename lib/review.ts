import type {
  ModerationSettingsResponse,
  ModerationSummary,
  TextModerationSummary,
} from "@/lib/api/types";
import { categoryLabel } from "@/lib/labels";
import { flagText, parseTextFlag } from "@/lib/text-flags";

/**
 * The classifier's cut points, as far as the settings endpoint reports them. The payload is
 * moderation-service's environment passed through as a loose map, so a value it leaves out is null
 * here rather than a line drawn at zero.
 */
export interface ReviewLines {
  reviewAt: number;
  rejectAt: number;
  minRejectFrames: number | null;
  /**
   * The zero-shot labels (violence, gore, drugs…) and the one line they share. They can hold a
   * video for a person and never remove one, so there is no reject line. Null when the classifier
   * does not report them — switched off, or older than them.
   */
  harm: { reviewAt: number; labels: string[] } | null;
}

/** The lines in force, or null when moderation-service did not answer or left them out. */
export function reviewLines(settings: ModerationSettingsResponse | null): ReviewLines | null {
  if (!settings?.reachable) return null;
  const { reviewAt, rejectAt, minRejectFrames, harmReviewAt, harmLabels } = settings.values;
  if (typeof reviewAt !== "number" || typeof rejectAt !== "number") return null;
  return {
    reviewAt,
    rejectAt,
    minRejectFrames: typeof minRejectFrames === "number" ? minRejectFrames : null,
    harm:
      typeof harmReviewAt === "number" && Array.isArray(harmLabels)
        ? { reviewAt: harmReviewAt, labels: harmLabels }
        : null,
  };
}

/**
 * The lines a score under this label was measured against. A harm label's score is on its own
 * scale, and drawing it against the NSFW lines would show a held video as "past the reject line"
 * for a check that cannot reject.
 */
export function linesFor(
  lines: ReviewLines | null,
  label: string | null,
): { reviewAt: number; rejectAt: number | null } | null {
  if (!lines) return null;
  if (label && lines.harm?.labels.includes(label)) return { reviewAt: lines.harm.reviewAt, rejectAt: null };
  return lines;
}

/**
 * media-worker's CaptionVerdict.REASON. When the frames pass and text moderation held the caption,
 * media-worker sends the video to review under this reason — the frames' own reason, if they had
 * one, after it in brackets — and keeps the frames' scores. It is not a check that failed.
 */
const CAPTION_HELD = "Caption held for review by text moderation";

/**
 * What the frames alone decided, when the caption is what held the video: the classifier's account
 * with the caption's hold taken back off. Null when the caption did not hold it. A caption only ever
 * holds a video whose frames passed, so their verdict is APPROVED.
 */
export function framesBeforeCaption(moderation: ModerationSummary): ModerationSummary | null {
  if (!moderation.reason?.startsWith(CAPTION_HELD)) return null;
  const own = /^ \((.*)\)$/.exec(moderation.reason.slice(CAPTION_HELD.length));
  return { ...moderation, verdict: "APPROVED", reason: own ? own[1] : null };
}

/** Why a check scored no frame, as one clause: the backend's own sentence, or the usual cause. */
function unscoredWhy(moderation: ModerationSummary): string {
  return (moderation.reason ?? "No frame could be sampled from the video").replace(/\.$/, "");
}

/**
 * Why automatic moderation held a video for a person, in the classifier's own terms. The rule is
 * moderation-service's verdict.py: under the review line it publishes, past the reject line with
 * enough frames past the review line it removes, and everything between waits for a moderator. A
 * check that could not finish is held too — no evidence is not an approval. A video can also be
 * held for its caption alone, whatever its frames scored.
 *
 * Measured against today's lines, which can have moved since the video was checked; the last
 * branch is the one place that shows.
 */
export function heldBecause(
  moderation: ModerationSummary | null,
  lines: ReviewLines | null,
): string {
  if (!moderation) return "No classifier result is stored for this video.";
  const frames = framesBeforeCaption(moderation);
  if (frames) {
    return `Held for its caption, which text moderation flagged. ${
      frames.totalFrames > 0
        ? `The frames passed: the highest scored ${frames.maxScore.toFixed(2)}.`
        : `${unscoredWhy(frames)}, so the frames were not scored.`
    }`;
  }
  if (moderation.reason) return `The check did not finish: ${moderation.reason}`;
  if (moderation.totalFrames === 0) {
    return "No frame could be sampled from the file, so there was nothing to score.";
  }
  if (!lines) {
    return "Held for a person to decide. The classifier's thresholds could not be read to say why.";
  }

  const score = moderation.maxScore.toFixed(2);
  const harm = moderation.label && lines.harm?.labels.includes(moderation.label) ? lines.harm : null;
  if (harm) {
    const harmAt = harm.reviewAt.toFixed(2);
    return moderation.maxScore >= harm.reviewAt
      ? `Its highest frame scored ${score} for ${moderation.label}, past the review line (${harmAt}). This check only holds a video for a person; it never removes one.`
      : `Its highest frame scored ${score} for ${moderation.label}, under today's review line (${harmAt}) — the line was lower when it was checked.`;
  }
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
  const frames = framesBeforeCaption(moderation);
  if (frames) return `${unscoredWhy(frames)}, so the frames were not scored. Its caption held it for review.`;
  const why = unscoredWhy(moderation);
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
 * What the classifier said, phrased for the videos table's reason column: a short label, and the
 * whole of it for the tooltip.
 *
 * A video the classifier removed or held carries no takedownReason — that field is only written by
 * an admin acting by hand — so without this the machine's calls are exactly the rows that show no
 * explanation. An APPROVED verdict is null: it is the outcome of every video on the platform, and
 * saying so in a column meant for problems buries the rows that are one.
 *
 * A check that scored no frame says so in the words the video's own page uses. The score is
 * printed raw rather than as a percentage, because the thresholds it is compared against are on the
 * same 0–1 scale and whoever is deciding whether to move one should not have to convert.
 *
 * A video held for its caption names the categories found in it, from `caption` — the video's
 * textModeration — and lists every flag in the detail.
 */
export function describeModeration(
  moderation: ModerationSummary | null,
  caption: TextModerationSummary | null = null,
): { label: string; detail: string } | null {
  if (!moderation || moderation.verdict === "APPROVED") return null;

  if (framesBeforeCaption(moderation)) {
    const flags = (caption?.flags ?? []).map(parseTextFlag);
    const categories = [...new Set(flags.map((flag) => categoryLabel(flag.category)))];
    return {
      label: categories.length > 0 ? `Caption held: ${categories.join(", ")}` : "Caption held",
      detail: [
        "Held by text moderation for its caption, not by the classifier or an admin. The frames passed.",
        ...flags.map(flagText),
      ].join("\n"),
    };
  }

  const unscored = unscoredBecause(moderation);
  if (unscored) return { label: "Not scored", detail: unscored };
  if (moderation.reason) return { label: "Check did not complete", detail: moderation.reason };

  const score = moderation.maxScore.toFixed(3);
  const frames = `${moderation.suspiciousFrames}/${moderation.totalFrames}`;
  const verb = moderation.verdict === "REJECTED" ? "Auto-removed" : "Flagged";
  return {
    label: `${verb}: ${moderation.label ?? "unknown"} ${score} · ${frames} frames`,
    detail: [
      `${verb} by the classifier, not by an admin.`,
      `Highest frame score: ${score} (${moderation.label ?? "unknown"})`,
      `Frames over the review threshold: ${frames}`,
      `Model: ${moderation.model ?? "unknown"} (${moderation.modelVersion ?? "unversioned"})`,
      `Checked: ${moderation.checkedAt}`,
    ].join("\n"),
  };
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
