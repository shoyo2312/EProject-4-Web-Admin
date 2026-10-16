// Run: node lib/__tests__/labels.test.mjs
import assert from "node:assert/strict";
import { VIDEO_STATUS_LABELS, categoryLabel, statusTabs } from "../labels.ts";

// Text moderation's categories by name; one this console does not know yet keeps its own.
assert.equal(categoryLabel("PERSONAL_INFO"), "Personal info");
assert.equal(categoryLabel("CREATOR_FILTER"), "Creator's filter");
assert.equal(categoryLabel("WEAPONS"), "WEAPONS");

// "All" first, then the statuses in the caller's order, each by the name its badge uses.
assert.deepEqual(statusTabs(["TAKEN_DOWN", "PUBLISHED"], VIDEO_STATUS_LABELS), [
  { value: "ALL", label: "All" },
  { value: "TAKEN_DOWN", label: "Taken down" },
  { value: "PUBLISHED", label: "Published" },
]);
assert.deepEqual(statusTabs([], VIDEO_STATUS_LABELS), [{ value: "ALL", label: "All" }]);

console.log("labels checks passed");
