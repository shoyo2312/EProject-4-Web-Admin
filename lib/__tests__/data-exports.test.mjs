// Run: node lib/__tests__/data-exports.test.mjs
import assert from "node:assert/strict";
import { dataExportHealth, dataExportScope } from "../data-exports.ts";

// Every category, in any order or repeated, reads as the whole archive.
assert.equal(
  dataExportScope(["YOUR_ACTIVITY", "POSTS", "DIRECT_MESSAGES", "PROFILE_AND_SETTINGS", "LIKES_AND_FAVORITES"]),
  "All data",
);
assert.equal(dataExportScope(["POSTS", "DIRECT_MESSAGES"]), "Posts, Direct Messages");

// Nothing wrong.
assert.deepEqual(dataExportHealth({ stalled: 0, failed: 0 }), { tone: "ok", text: "Running normally." });

// Failures alone are a warning, counted in the noun.
assert.equal(dataExportHealth({ stalled: 0, failed: 1 }).tone, "warn");
assert.match(dataExportHealth({ stalled: 0, failed: 1 }).text, /^1 request failed/);
assert.match(dataExportHealth({ stalled: 0, failed: 3 }).text, /^3 requests failed/);

// A stall outranks failures: nothing is being built at all.
assert.equal(dataExportHealth({ stalled: 2, failed: 5 }).tone, "bad");
assert.match(dataExportHealth({ stalled: 2, failed: 5 }).text, /^2 requests have waited/);
assert.match(dataExportHealth({ stalled: 1, failed: 0 }).text, /^1 request has waited/);
