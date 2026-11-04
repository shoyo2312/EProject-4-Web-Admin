// Run: node lib/__tests__/list-filters.test.mjs
import assert from "node:assert/strict";
import { auditFilters, reportFilters, termFilters, trashFilters, userFilters, videoFilters } from "../list-filters.ts";

// Known values pass; anything else is no filter at all rather than a 400 from the backend.
assert.deepEqual(userFilters({ q: "minh", status: "BANNED", sort: "username", dir: "asc" }), {
  q: "minh",
  status: "BANNED",
  sort: "username",
  ascending: true,
});
assert.deepEqual(userFilters({ status: "banned", sort: "passwordHash" }), {
  q: undefined,
  status: undefined,
  sort: "createdAt",
  ascending: false,
});

assert.deepEqual(videoFilters({ status: "PENDING_REVIEW" }), {
  q: undefined,
  ownerId: undefined,
  status: "PENDING_REVIEW",
  deletedOnly: false,
  sort: "createdAt",
  ascending: false,
});
// "Deleted" is not a status: it filters on deletedAt, with no status filter beside it.
assert.deepEqual(videoFilters({ q: "cat", status: "DELETED" }), {
  q: "cat",
  ownerId: undefined,
  status: undefined,
  deletedOnly: true,
  sort: "createdAt",
  ascending: false,
});
// An owner is exact and replaces the search term rather than widening it; a non-id is no filter.
assert.deepEqual(videoFilters({ owner: "1234567890123456789", q: "cat" }), {
  q: undefined,
  ownerId: "1234567890123456789",
  status: undefined,
  deletedOnly: false,
  sort: "createdAt",
  ascending: false,
});
assert.equal(videoFilters({ sort: "viewCount", dir: "asc" }).sort, "viewCount");
assert.equal(videoFilters({ sort: "storageKey" }).sort, "createdAt", "only the listed columns reach Mongo");

// The trash defaults to soonest-purged first, and a header's "desc" is the only way out of it.
assert.deepEqual(trashFilters({}), { q: undefined, sort: "deletedAt", ascending: true });
assert.deepEqual(trashFilters({ sort: "deletedAt", dir: "desc" }), { q: undefined, sort: "deletedAt", ascending: false });
assert.deepEqual(trashFilters({ sort: "title" }), { q: undefined, sort: "title", ascending: false });
assert.equal(videoFilters({ owner: "@minh", q: "cat" }).ownerId, undefined);
assert.equal(videoFilters({ owner: "@minh", q: "cat" }).q, "cat");

assert.deepEqual(reportFilters({ q: " spam ", status: "RESOLVED", target: "VIDEO", sort: "status", dir: "asc" }), {
  q: "spam",
  status: "RESOLVED",
  targetType: "VIDEO",
  sort: "status",
  ascending: true,
});
// An unknown sort column would be a 500; the ledger falls back to newest first.
assert.deepEqual(reportFilters({ q: "   ", sort: "reason; drop", dir: "up" }), {
  q: undefined,
  status: undefined,
  targetType: undefined,
  sort: "createdAt",
  ascending: false,
});

assert.deepEqual(auditFilters({ admin: "361442487587172352", type: "BAN_USER", sort: "actionType", dir: "asc" }), {
  adminId: "361442487587172352",
  actionType: "BAN_USER",
  sort: "actionType",
  ascending: true,
});
// The admin column is not a sort admin-service offers; it falls back to newest first.
assert.deepEqual(auditFilters({ admin: "@admin", type: "ban", sort: "adminId" }), {
  adminId: undefined,
  actionType: undefined,
  sort: "createdAt",
  ascending: false,
});

// The Terms page: a known action, and a term with its spaces trimmed off; nothing else is a filter.
assert.deepEqual(termFilters({ q: " nhà cái ", action: "EXEMPT" }), { q: "nhà cái", action: "EXEMPT" });
assert.deepEqual(termFilters({ q: "  ", action: "exempt" }), { q: undefined, action: undefined });

console.log("list-filters checks passed");
