// Run: node lib/moderation.check.mjs
import assert from "node:assert/strict";
import { BAN_DURATIONS, banDaysOf, targetHref } from "./moderation.ts";

// Every target type opens on its own page; a comment through the video its thread lives on.
assert.equal(targetHref("USER", "365860036126752768"), "/users/365860036126752768");
assert.equal(targetHref("VIDEO", "361443887270928384"), "/videos/361443887270928384");
assert.equal(targetHref("COMMENT", "3614437515:67012096"), "/comments?videoId=3614437515");
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

console.log("moderation checks passed");
