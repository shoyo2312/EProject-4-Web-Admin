// Run: node lib/__tests__/search.test.mjs
import assert from "node:assert/strict";
import { looksLikeId, matchPages, moveSelection } from "../search.ts";

// A pasted id is looked up as one; a handle, a title or a short tail is not.
assert.equal(looksLikeId("365860036126752768"), true);
assert.equal(looksLikeId("  361443887270928384 "), true);
assert.equal(looksLikeId("57182976"), false, "the tables show tails, not ids");
assert.equal(looksLikeId("user1u5baa"), false);
assert.equal(looksLikeId(""), false);

const pages = [
  { label: "Dashboard", section: "Main Menu", href: "/dashboard" },
  { label: "Reports Queue", section: "Moderation", href: "/moderation/reports" },
  { label: "Audit Log", section: "Moderation", href: "/moderation/actions" },
  { label: "Users", section: "Management", href: "/users" },
];
const hrefs = (query) => matchPages(query, pages).map((page) => page.href);

assert.deepEqual(hrefs(""), pages.map((page) => page.href), "nothing typed lists every page");
assert.deepEqual(hrefs("us"), ["/users"]);
// A name that starts with the term outranks one that only contains it — in its name, or, for the
// dashboard, in its section ("Main Menu").
assert.deepEqual(hrefs("u"), ["/users", "/dashboard", "/moderation/reports", "/moderation/actions"]);
// The section is searched too, so "moderation" finds both of its pages.
assert.deepEqual(hrefs("MODERATION"), ["/moderation/reports", "/moderation/actions"]);
assert.deepEqual(hrefs("nothing like it"), []);

// Arrow keys wrap, and start from the end they point at when nothing is highlighted yet.
assert.equal(moveSelection(-1, 1, 3), 0);
assert.equal(moveSelection(-1, -1, 3), 2);
assert.equal(moveSelection(2, 1, 3), 0);
assert.equal(moveSelection(0, -1, 3), 2);
assert.equal(moveSelection(1, 1, 3), 2);
assert.equal(moveSelection(0, 1, 0), -1, "an empty list highlights nothing");

console.log("search checks passed");
