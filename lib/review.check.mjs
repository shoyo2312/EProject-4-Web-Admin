// Run: node lib/review.check.mjs
import assert from "node:assert/strict";
import {
  describeModeration,
  heldBecause,
  nextUndecided,
  reviewCommand,
  reviewLines,
  unscoredBecause,
} from "./review.ts";

// The settings payload is a loose map: anything missing or of the wrong type is not a line.
const values = { reviewAt: 0.6, rejectAt: 0.9, minRejectFrames: 2, model: "nsfw" };
assert.deepEqual(reviewLines({ reachable: true, values }), {
  reviewAt: 0.6,
  rejectAt: 0.9,
  minRejectFrames: 2,
});
assert.equal(reviewLines({ reachable: false, values }), null, "an unreachable classifier has no lines");
assert.equal(reviewLines(null), null);
assert.equal(reviewLines({ reachable: true, values: { reviewAt: "0.6", rejectAt: 0.9 } }), null);
assert.equal(
  reviewLines({ reachable: true, values: { reviewAt: 0.6, rejectAt: 0.9 } }).minRejectFrames,
  null,
  "a missing frame rule is unknown, not zero",
);

const lines = { reviewAt: 0.6, rejectAt: 0.9, minRejectFrames: 2 };
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
