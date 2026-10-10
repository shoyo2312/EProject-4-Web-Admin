// Run: node lib/__tests__/labels.test.mjs
import assert from "node:assert/strict";
import { VIDEO_STATUS_LABELS, statusTabs } from "../labels.ts";

// "All" first, then the statuses in the caller's order, each by the name its badge uses.
assert.deepEqual(statusTabs(["TAKEN_DOWN", "PUBLISHED"], VIDEO_STATUS_LABELS), [
  { value: "ALL", label: "All" },
  { value: "TAKEN_DOWN", label: "Taken down" },
  { value: "PUBLISHED", label: "Published" },
]);
assert.deepEqual(statusTabs([], VIDEO_STATUS_LABELS), [{ value: "ALL", label: "All" }]);

console.log("labels checks passed");
