// Run: node lib/__tests__/moderation.test.mjs
import assert from "node:assert/strict";
import {
  BAN_DURATIONS,
  PRESET_REASONS,
  banDaysOf,
  commentStanding,
  parseCommentTarget,
  targetHref,
  userDecision,
  videoDecision,
  videoDecisions,
} from "../moderation.ts";

// A held video is approved; a removed one — by an admin or by the classifier — is restored; and
// anything else on offer is a takedown.
assert.equal(videoDecision("PENDING_REVIEW"), "approve");
assert.equal(videoDecision("TAKEN_DOWN"), "restore");
assert.equal(videoDecision("REJECTED"), "restore");
for (const status of ["PUBLISHED", "PROCESSING", "PENDING_MODERATION", "FAILED"]) {
  assert.equal(videoDecision(status), "takedown", status);
}

// A held video's page offers both answers, approve first; every other state keeps its one.
assert.deepEqual(videoDecisions("PENDING_REVIEW"), ["approve", "reject"]);
assert.deepEqual(videoDecisions("TAKEN_DOWN"), ["restore"]);
assert.deepEqual(videoDecisions("PUBLISHED"), ["takedown"]);
// A rejection is a takedown, so it is explained in the takedown's words.
assert.deepEqual(PRESET_REASONS.reject, PRESET_REASONS.takedown);

// A comment target is "videoId:commentId"; anything else names no comment.
assert.deepEqual(parseCommentTarget("361443887270928384:4417"), {
  videoId: "361443887270928384",
  commentId: "4417",
});
for (const bad of ["4417", ":4417", "361443887270928384:", "a:b:c"]) {
  assert.equal(parseCommentTarget(bad), null, bad);
}

// Every target type opens on its own page; a comment through the video its thread lives on.
assert.equal(targetHref("USER", "365860036126752768"), "/users/365860036126752768");
assert.equal(targetHref("VIDEO", "361443887270928384"), "/videos/361443887270928384");
assert.equal(targetHref("COMMENT", "3614437515:67012096"), "/comments?videoId=3614437515&comment=67012096");
// A comment id with no video in front reaches nothing, so it links nowhere.
assert.equal(targetHref("COMMENT", "67012096"), null);
assert.equal(targetHref("COMMENT", "a:b:c"), null);

// Permanent is the absence of an end, which admin-service reads as null — not 0, which would be a
// ban that lapses on the next sweep.
assert.equal(banDaysOf("permanent"), null);

// Every other choice on offer reaches admin-service as the number of days it is labelled with.
for (const { value, label } of BAN_DURATIONS) {
  if (value === "permanent") continue;
  assert.equal(banDaysOf(value), Number.parseInt(label, 10), label);
}

// Permanent stays first: the segmented control and both forms take it as the default.
assert.equal(BAN_DURATIONS[0].value, "permanent");

// Comment strikes: a restriction in force is what lifting ends; with none, the strikes and the step
// are what it clears; a clean record offers nothing to lift.
{
  const now = Date.parse("2026-10-15T08:00:00Z");
  const standing = (restrictedUntil, strikes, step) =>
    commentStanding({ userId: "7", restrictedUntil, strikes, step }, now);
  const later = "2026-10-15T13:00:00Z";
  assert.deepEqual(standing(later, 0, 2), { restrictedUntil: later, lifts: "restriction" });
  assert.deepEqual(standing(null, 2, 0), { restrictedUntil: null, lifts: "strikes" });
  assert.deepEqual(standing(null, 0, 1), { restrictedUntil: null, lifts: "strikes" }, "the step alone");
  assert.deepEqual(standing(null, 0, 0), { restrictedUntil: null, lifts: null });
  // Read after it ran out: no longer a restriction, whatever the page was rendered with.
  assert.deepEqual(standing("2026-10-15T07:59:00Z", 0, 1), { restrictedUntil: null, lifts: "strikes" });
}

// An account's directory row and the bulk bar offer the same answer: lift a ban, or impose one.
assert.equal(userDecision("BANNED"), "unban");
for (const status of ["ACTIVE", "LOCKED", "DEACTIVATED"]) {
  assert.equal(userDecision(status), "ban", status);
}

console.log("moderation checks passed");
