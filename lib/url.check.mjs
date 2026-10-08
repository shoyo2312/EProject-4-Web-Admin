// Run: node lib/url.check.mjs
import assert from "node:assert/strict";
import { internalPath } from "./url.ts";

// The page the admin was opening comes back, query and all.
assert.equal(internalPath("/videos/123"), "/videos/123");
assert.equal(internalPath("/users?status=BANNED#top"), "/users?status=BANNED#top");

// Nothing to honour.
assert.equal(internalPath(null), null);
assert.equal(internalPath(""), null);

// Every way of leaving the site after signing in — the ones that start with a slash included.
for (const offsite of [
  "https://evil.example/dashboard",
  "//evil.example",
  "/\\evil.example",
  "/\t/evil.example",
  "javascript:alert(1)",
]) {
  assert.equal(internalPath(offsite), null, offsite);
}

console.log("url checks passed");
