// Run: node lib/__tests__/review.test.mjs
import assert from "node:assert/strict";
import { registerHooks } from "node:module";

// review.ts names a caption's flags through lib/text-flags and lib/labels, by the "@/" alias only
// the bundler knows. Resolved here the way tsconfig maps it, before the module is loaded.
registerHooks({
  resolve: (specifier, context, next) =>
    next(
      specifier.startsWith("@/") ? new URL(`../../${specifier.slice(2)}.ts`, import.meta.url).href : specifier,
      context,
    ),
});
const {
  describeModeration,
  framesBeforeCaption,
  heldBecause,
  linesFor,
  nextUndecided,
  reviewCommand,
  reviewLines,
  unscoredBecause,
} = await import("../review.ts");

// The settings payload is a loose map: anything missing or of the wrong type is not a line.
const values = { reviewAt: 0.6, rejectAt: 0.9, minRejectFrames: 2, model: "nsfw" };
assert.deepEqual(reviewLines({ reachable: true, values }), {
  reviewAt: 0.6,
  rejectAt: 0.9,
  minRejectFrames: 2,
  harm: null,
});
assert.deepEqual(
  reviewLines({ reachable: true, values: { ...values, harmReviewAt: 0.55, harmLabels: ["violence", "drugs"] } }).harm,
  { reviewAt: 0.55, labels: ["violence", "drugs"] },
);
assert.equal(reviewLines({ reachable: false, values }), null, "an unreachable classifier has no lines");
assert.equal(reviewLines(null), null);
assert.equal(reviewLines({ reachable: true, values: { reviewAt: "0.6", rejectAt: 0.9 } }), null);
assert.equal(
  reviewLines({ reachable: true, values: { reviewAt: 0.6, rejectAt: 0.9 } }).minRejectFrames,
  null,
  "a missing frame rule is unknown, not zero",
);

const lines = { reviewAt: 0.6, rejectAt: 0.9, minRejectFrames: 2, harm: { reviewAt: 0.55, labels: ["gore", "drugs"] } };
const scored = (maxScore, suspiciousFrames, extra = {}) => ({
  verdict: "REVIEW",
  label: "nsfw",
  maxScore,
  suspiciousFrames,
  totalFrames: 10,
  model: "m",
  modelVersion: "v1",
  reason: null,
  checkedAt: "2026-10-01T00:00:00Z",
  ...extra,
});

// Between the two lines: the ordinary hold.
assert.match(heldBecause(scored(0.734, 3), lines), /0\.73: past the review line \(0\.60\), short of the reject line \(0\.90\)/);
// Past the reject line on one frame: verdict.py needs a second frame to agree before removing.
assert.match(
  heldBecause(scored(0.95, 1), lines),
  /past the reject line \(0\.90\), but only 1 frame reached the review line — an automatic removal needs 2/,
);
assert.match(heldBecause(scored(0.95, 1), { ...lines, minRejectFrames: null }), /0\.95, past the reject line \(0\.90\)\.$/);
// Under today's review line: only possible if the line moved since the check.
assert.match(heldBecause(scored(0.5, 0), lines), /under today's review line \(0\.60\)/);
// A check that did not finish, or had no frames, says so before any score.
assert.equal(heldBecause(scored(0, 0, { reason: "decode failed" }), lines), "The check did not finish: decode failed");
assert.match(heldBecause(scored(0, 0, { totalFrames: 0 }), lines), /No frame could be sampled/);
assert.match(heldBecause(scored(0.7, 2), null), /thresholds could not be read/);
assert.match(heldBecause(null, lines), /No classifier result/);

// A harm label is measured on its own line, and never against the NSFW reject line it cannot reach.
assert.equal(
  heldBecause(scored(0.995, 10, { label: "gore" }), lines),
  "Its highest frame scored 0.99 for gore, past the review line (0.55). This check only holds a video for a person; it never removes one.",
);
assert.match(heldBecause(scored(0.5, 0, { label: "drugs" }), lines), /for drugs, under today's review line \(0\.55\)/);
assert.deepEqual(linesFor(lines, "gore"), { reviewAt: 0.55, rejectAt: null });
assert.equal(linesFor(lines, "nsfw"), lines);
assert.equal(linesFor({ ...lines, harm: null }, "gore").rejectAt, 0.9, "an older classifier has no harm labels");
assert.equal(linesFor(null, "gore"), null);

// No frame scored: the zeros stored for one are not a score, so the reason stands in for it —
// and why a check with no result still holds the video, or that a passed one was never scored.
const unscored = (verdict, reason) =>
  scored(0, 0, { verdict, reason, label: null, totalFrames: 0, model: null, modelVersion: null });
assert.equal(unscoredBecause(scored(0.734, 3)), null);
assert.equal(
  unscoredBecause(unscored("REVIEW", "No automatic verdict arrived within PT1H")),
  "No automatic verdict arrived within PT1H. A check that cannot finish holds the video for a person rather than passing it.",
);
assert.equal(
  unscoredBecause(unscored("APPROVED", "Automatic moderation is disabled")),
  "Automatic moderation is disabled, so it was passed without a score.",
);
assert.match(unscoredBecause(unscored("REVIEW", null)), /^No frame could be sampled from the video\. A check/);
assert.match(unscoredBecause(unscored("REVIEW", "Timed out.")), /^Timed out\. A check/, "one full stop, not two");

// The videos table's reason column: nothing for a pass, the same words as the video's page for a
// check that scored nothing, and the figures for one that did.
assert.equal(describeModeration(null), null);
assert.equal(describeModeration(scored(0.1, 0, { verdict: "APPROVED" })), null);
assert.equal(describeModeration(unscored("APPROVED", "Automatic moderation is disabled")), null);
{
  const held = unscored("REVIEW", "No automatic verdict arrived within PT1H");
  assert.deepEqual(describeModeration(held), { label: "Not scored", detail: unscoredBecause(held) });
}
assert.equal(describeModeration(scored(0.734, 3)).label, "Flagged: nsfw 0.734 · 3/10 frames");
assert.match(describeModeration(scored(0.734, 3)).detail, /^Flagged by the classifier, not by an admin\./);
assert.equal(describeModeration(scored(0.95, 4, { verdict: "REJECTED" })).label, "Auto-removed: nsfw 0.950 · 4/10 frames");

// Held for its caption: media-worker turns the frames' pass into REVIEW under a reason of its own
// and keeps their scores. That reason is not a check that failed, and must not read as one.
const CAPTION = "Caption held for review by text moderation";
const captionHeld = scored(0.081, 0, { reason: CAPTION });
const captionHeldUnscored = unscored("REVIEW", `${CAPTION} (Automatic moderation is disabled)`);
assert.deepEqual(framesBeforeCaption(captionHeld), { ...captionHeld, verdict: "APPROVED", reason: null });
assert.equal(
  framesBeforeCaption(captionHeldUnscored).reason,
  "Automatic moderation is disabled",
  "the frames' own reason rides along in brackets",
);
assert.equal(framesBeforeCaption(scored(0.734, 3)), null);
assert.equal(framesBeforeCaption(scored(0, 0, { reason: "decode failed" })), null);

assert.equal(
  heldBecause(captionHeld, lines),
  "Held for its caption, which text moderation flagged. The frames passed: the highest scored 0.08.",
);
assert.equal(
  heldBecause(captionHeldUnscored, lines),
  "Held for its caption, which text moderation flagged. Automatic moderation is disabled, so the frames were not scored.",
);
assert.match(heldBecause(captionHeld, null), /^Held for its caption/, "the thresholds have no say in it");

assert.equal(unscoredBecause(captionHeld), null, "its frames were scored");
assert.equal(
  unscoredBecause(captionHeldUnscored),
  "Automatic moderation is disabled, so the frames were not scored. Its caption held it for review.",
);

// The table names the caption, and what was found in which part of it.
{
  const caption = {
    verdict: "REVIEW",
    flags: ["DESCRIPTION:SPAM:link:bit.ly", "TITLE:PERSONAL_INFO:phone", "DESCRIPTION:SPAM:link:t.co"],
    version: "rules-2026.10.13",
    enforced: true,
    checkedAt: "2026-10-01T00:00:00Z",
  };
  assert.deepEqual(describeModeration(captionHeld, caption), {
    label: "Caption held: Spam, Personal info",
    detail: [
      "Held by text moderation for its caption, not by the classifier or an admin. The frames passed.",
      "Description · Spam: link:bit.ly",
      "Title · Personal info: phone",
      "Description · Spam: link:t.co",
    ].join("\n"),
  });
  assert.equal(describeModeration(captionHeldUnscored, caption).label, "Caption held: Spam, Personal info");
}
assert.equal(describeModeration(captionHeld).label, "Caption held", "no caption record to name a category from");

// After a decision: the next undecided after the current one, then any skipped before it.
const ids = ["a", "b", "c", "d"];
assert.equal(nextUndecided(ids, new Set(["a"]), 0), 1);
assert.equal(nextUndecided(ids, new Set(["a", "b", "c"]), 1), 3, "decided videos are stepped over");
assert.equal(nextUndecided(ids, new Set(["c", "d"]), 3), 0, "wraps back to what was skipped");
assert.equal(nextUndecided(ids, new Set(ids), 2), -1, "the batch is done");
assert.equal(nextUndecided(ids, new Set(), -1), 0, "from the top");
assert.equal(nextUndecided([], new Set(), -1), -1);

// Keys: letters only on their own, never while typing or with a modifier.
assert.equal(reviewCommand("j", false, false), "next");
assert.equal(reviewCommand("K", false, false), "previous", "Shift or caps lock still counts");
assert.equal(reviewCommand("a", false, false), "approve");
assert.equal(reviewCommand("r", false, false), "reject");
assert.equal(reviewCommand("r", true, false), null, "⌘R reloads the page");
assert.equal(reviewCommand("a", false, true), null, "typing a reason");
assert.equal(reviewCommand("x", false, false), null);

console.log("review checks passed");
