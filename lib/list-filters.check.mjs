// Run: node lib/list-filters.check.mjs
import assert from "node:assert/strict";
import { auditFilters, reportFilters, userFilters, videoFilters } from "./list-filters.ts";

// Known values pass; anything else is no filter at all rather than a 400 from the backend.
assert.deepEqual(userFilters({ q: "minh", status: "BANNED" }), { q: "minh", status: "BANNED" });
assert.deepEqual(userFilters({ status: "banned" }), { q: undefined, status: undefined });

assert.deepEqual(videoFilters({ status: "PENDING_REVIEW" }), {
  q: undefined,
  status: "PENDING_REVIEW",
  deletedOnly: false,
});
// "Deleted" is not a status: it filters on deletedAt, with no status filter beside it.
assert.deepEqual(videoFilters({ q: "cat", status: "DELETED" }), {
  q: "cat",
  status: undefined,
  deletedOnly: true,
});

assert.deepEqual(reportFilters({ status: "RESOLVED", target: "VIDEO", sort: "status", dir: "asc" }), {
  status: "RESOLVED",
  targetType: "VIDEO",
  sort: "status",
  ascending: true,
});
// An unknown sort column would be a 500; the ledger falls back to newest first.
assert.deepEqual(reportFilters({ sort: "reason; drop", dir: "up" }), {
  status: undefined,
  targetType: undefined,
  sort: "createdAt",
  ascending: false,
});

assert.deepEqual(auditFilters({ admin: "361442487587172352", type: "BAN_USER" }), {
  adminId: "361442487587172352",
  actionType: "BAN_USER",
});
assert.deepEqual(auditFilters({ admin: "@admin", type: "ban" }), {
  adminId: undefined,
  actionType: undefined,
});

console.log("list-filters checks passed");
