// Run: node lib/review.check.mjs
import assert from "node:assert/strict";
import { heldBecause, nextUndecided, reviewCommand, reviewLines } from "./review.ts";

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
