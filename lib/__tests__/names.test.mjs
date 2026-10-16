// Run: node lib/__tests__/names.test.mjs
import assert from "node:assert/strict";
import { NO_NAMES, idsToName, targetName } from "../names.ts";

// Accounts named anywhere on the page — admins, reporters, reported users — go in one batch;
// reported videos in another; a comment is named by its text, read when its row opens.
const wanted = idsToName(
  [
    { targetType: "USER", targetId: "u-target" },
    { targetType: "VIDEO", targetId: "v1" },
    { targetType: "VIDEO", targetId: "v1" },
    { targetType: "COMMENT", targetId: "v2:c9" },
  ],
  ["u-admin", null, "u-target"],
);
assert.deepEqual(wanted.userIds.sort(), ["u-admin", "u-target"], "deduplicated, nulls dropped");
assert.deepEqual(wanted.videoIds, ["v1"]);

const names = {
  handles: { "u-target": "@mikha" },
  videos: {
    v1: { title: "Night street", thumbnailUrl: null, userId: "u-owner" },
    v3: { title: "", thumbnailUrl: null, userId: "u-owner" },
  },
};
assert.equal(targetName(names, "USER", "u-target"), "@mikha");
assert.equal(targetName(names, "VIDEO", "v1"), "Night street");
// Nothing to show falls back to the id at the call site, never to a blank cell.
assert.equal(targetName(names, "VIDEO", "v3"), null, "an untitled video is not a name");
assert.equal(targetName(names, "VIDEO", "gone"), null);
assert.equal(targetName(names, "COMMENT", "v2:c9"), null);
assert.equal(targetName(NO_NAMES, "USER", "u-target"), null);

console.log("names checks passed");
