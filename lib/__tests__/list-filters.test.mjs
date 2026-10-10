// Run: node lib/__tests__/list-filters.test.mjs
import assert from "node:assert/strict";
import { auditFilters, reportFilters, userFilters, videoFilters } from "../list-filters.ts";

// Known values pass; anything else is no filter at all rather than a 400 from the backend.
assert.deepEqual(userFilters({ q: "minh", status: "BANNED" }), { q: "minh", status: "BANNED" });
assert.deepEqual(userFilters({ status: "banned" }), { q: undefined, status: undefined });

assert.deepEqual(videoFilters({ status: "PENDING_REVIEW" }), {
  q: undefined,
  ownerId: undefined,
  status: "PENDING_REVIEW",
  deletedOnly: false,
});
// "Deleted" is not a status: it filters on deletedAt, with no status filter beside it.
assert.deepEqual(videoFilters({ q: "cat", status: "DELETED" }), {
  q: "cat",
  ownerId: undefined,
  status: undefined,
  deletedOnly: true,
});
// An owner is exact and replaces the search term rather than widening it; a non-id is no filter.
assert.deepEqual(videoFilters({ owner: "1234567890123456789", q: "cat" }), {
  q: undefined,
  ownerId: "1234567890123456789",
  status: undefined,
  deletedOnly: false,
});
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

console.log("list-filters checks passed");
