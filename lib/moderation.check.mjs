// Run: node lib/moderation.check.mjs
import assert from "node:assert/strict";
import { BAN_DURATIONS, banDaysOf } from "./moderation.ts";

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
