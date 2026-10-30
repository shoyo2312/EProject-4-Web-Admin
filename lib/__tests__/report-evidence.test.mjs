// Run: node lib/__tests__/report-evidence.test.mjs
import assert from "node:assert/strict";
import { describeEvidence, isDirectMessage, sourceLabel } from "../report-evidence.ts";

// A report from before the field existed is a profile report.
assert.equal(isDirectMessage({}), false);
assert.equal(sourceLabel({}), "Profile");
assert.equal(sourceLabel({ source: "PROFILE", evidenceCount: 0 }), "Profile");

assert.equal(sourceLabel({ source: "DIRECT_MESSAGE", evidenceCount: 1 }), "Direct message · 1 message");
assert.equal(sourceLabel({ source: "DIRECT_MESSAGE", evidenceCount: 3 }), "Direct message · 3 messages");

assert.equal(describeEvidence({ type: "TEXT", text: "hi" }), "hi");
assert.equal(describeEvidence({ type: "STICKER", stickerId: "s1", text: null }), "Sticker s1");
assert.equal(describeEvidence({ type: "VIDEO", videoId: "v9", text: null }), "Shared video v9");
assert.equal(describeEvidence({ type: "VIDEO", videoId: "v9", text: "look" }), "Shared video v9 — “look”");
assert.equal(describeEvidence({ type: "STORY_REPLY", storyId: "7", text: "nice" }), "Reply to story 7: nice");
// A type this console does not know yet is still readable.
assert.equal(describeEvidence({ type: "FUTURE", text: null }), "FUTURE message");

console.log("report-evidence ok");
