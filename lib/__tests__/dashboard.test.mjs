// Run: node lib/__tests__/dashboard.test.mjs
import assert from "node:assert/strict";
import { registerHooks } from "node:module";

registerHooks({
  resolve: (specifier, context, next) =>
    next(
      specifier.startsWith("@/") ? new URL(`../../${specifier.slice(2)}.ts`, import.meta.url).href : specifier,
      context,
    ),
});
const { accountsToWatch, decisionPace, isStale, oldest, waitingSummary, waitingTiles } =
  await import("../dashboard.ts");

// The header used to count reports only, and read "Nothing is waiting" over 21 held videos.
assert.equal(waitingSummary(0, 0), "Nothing is waiting for a decision.");
assert.equal(waitingSummary(21, 0), "21 videos waiting for review.");
assert.equal(waitingSummary(0, 3), "3 reports waiting for review.");
assert.equal(waitingSummary(1, 1), "1 video and 1 report waiting for review.");
assert.equal(waitingSummary(1200, 2), "1,200 videos and 2 reports waiting for review.");
// A listing that could not be read is not an empty one.
assert.equal(waitingSummary(null, 0), "Held videos could not be read.");
assert.equal(waitingSummary(null, 3), "3 reports waiting for review. Held videos could not be read.");

// By time, not by string: Instants serialize with and without fractions, and "…01.5Z" sorts
// before "…01Z" as text although it is the later one.
assert.equal(oldest(["2026-10-21T12:00:01.5Z", "2026-10-21T12:00:01Z"]), "2026-10-21T12:00:01Z");
assert.equal(oldest([null, undefined, "2026-10-20T00:00:00Z"]), "2026-10-20T00:00:00Z");
assert.equal(oldest([]), null);

const now = Date.parse("2026-10-22T12:00:00Z");
assert.equal(isStale("2026-10-21T11:59:00Z", now), true);
assert.equal(isStale("2026-10-21T12:01:00Z", now), false);
assert.equal(isStale(null, now), false);

const MIN = 60_000;
const report = (closedMin, resolvedBy = "admin-1") => ({
  createdAt: new Date(now).toISOString(),
  resolvedAt: closedMin === null ? null : new Date(now + closedMin * MIN).toISOString(),
  resolvedBy: closedMin === null ? null : resolvedBy,
});
// Pending reports have no decision time yet; they are left out, not counted as zero.
assert.deepEqual(decisionPace([report(10), report(null), report(30), report(20)]), {
  medianMs: 20 * MIN,
  decided: 3,
});
assert.deepEqual(decisionPace([report(10), report(40)]), { medianMs: 25 * MIN, decided: 2 });
assert.deepEqual(decisionPace([report(null)]), { medianMs: null, decided: 0 });
// admin-service closes some reports itself — on arrival against a target already enforced, and in
// the stale sweep — with nobody named. Those took no person's time and would drag the median to 0.
assert.deepEqual(decisionPace([report(0, null), report(0, null), report(0, null), report(240)]), {
  medianMs: 240 * MIN,
  decided: 1,
});

const held = (userId) => ({ userId });
const group = (targetType, targetId, reportCount) => ({ targetType, targetId, reportCount });

// Held uploads count against their owner, one each.
assert.deepEqual(
  accountsToWatch({ held: [held("a"), held("b"), held("a")], queue: [], videoOwners: {} }),
  [
    { userId: "a", held: 2, reports: 0 },
    { userId: "b", held: 1, reports: 0 },
  ],
);

// Reports against the account and against its videos both land on the account. A video nobody
// could name an owner for, and a comment (whose author the queue does not carry), add nobody.
assert.deepEqual(
  accountsToWatch({
    held: [held("a")],
    queue: [
      group("USER", "a", 3),
      group("VIDEO", "v1", 2),
      group("VIDEO", "v-unknown", 9),
      group("COMMENT", "v1:c1", 9),
    ],
    videoOwners: { v1: "b" },
  }),
  [
    { userId: "a", held: 1, reports: 3 },
    { userId: "b", held: 0, reports: 2 },
  ],
);

// A reporter picks the target id. One spelled like an Object property must not read the
// prototype as an owner — that put a function where a user id goes and broke the dashboard.
assert.deepEqual(
  accountsToWatch({
    held: [],
    queue: [group("VIDEO", "constructor", 5), group("VIDEO", "__proto__", 5), group("VIDEO", "toString", 5)],
    videoOwners: {},
  }),
  [],
);

// Heaviest first; a tie goes to the account with more reports — people asked about it.
assert.deepEqual(
  accountsToWatch({
    held: [held("a"), held("a"), held("c")],
    queue: [group("USER", "b", 2), group("USER", "c", 1)],
    videoOwners: {},
    limit: 2,
  }),
  [
    { userId: "b", held: 0, reports: 2 },
    { userId: "c", held: 1, reports: 1 },
  ],
);

const hoursAgo = (h) => new Date(now - h * 3_600_000).toISOString();
const tiles = (input) =>
  waitingTiles({
    held: { total: 0, since: null },
    reports: { pending: 0, targets: 0, since: null },
    exports: { stalled: 0, failed: 0 },
    now,
    ...input,
  });
const [videos, reports, exports] = tiles({});
assert.deepEqual(videos, {
  label: "Videos to review",
  count: 0,
  detail: "Queue is clear",
  tone: "ok",
  href: "/moderation/review",
});
assert.equal(reports.detail, "Queue is clear");
assert.deepEqual(exports, {
  label: "Data export problems",
  count: 0,
  detail: "Running normally",
  tone: "ok",
  href: "/system/queues",
});

// Past a day the queue is behind, and says so in words as well as in red.
assert.deepEqual(tiles({ held: { total: 21, since: hoursAgo(26) } })[0], {
  label: "Videos to review",
  count: 21,
  detail: "Oldest held 1d ago — overdue",
  tone: "bad",
  href: "/moderation/review",
});
assert.equal(tiles({ held: { total: 2, since: hoursAgo(3) } })[0].detail, "Oldest held 3h ago");
assert.equal(tiles({ held: { total: 2, since: hoursAgo(3) } })[0].tone, "ok");
assert.deepEqual(tiles({ held: null })[0], {
  label: "Videos to review",
  count: null,
  detail: "Could not be read",
  tone: "ok",
  href: "/moderation/review",
});

// The count is reports; the detail is how many decisions they make and how old the oldest is.
assert.deepEqual(tiles({ reports: { pending: 5, targets: 2, since: hoursAgo(3) } })[1], {
  label: "Reports to decide",
  count: 5,
  detail: "2 targets · oldest 3h ago",
  tone: "ok",
  href: "/moderation/reports",
});
assert.equal(tiles({ reports: { pending: 1, targets: 1, since: hoursAgo(30) } })[1].tone, "bad");
assert.equal(
  tiles({ reports: { pending: 5, targets: null, since: null } })[1].detail,
  "Queue could not be read",
);

// The number is what the detail describes: stalled builds and given-up ones together.
assert.deepEqual(tiles({ exports: { stalled: 2, failed: 1 } })[2], {
  label: "Data export problems",
  count: 3,
  detail: "2 stalled past every retry · 1 failed in 7 days",
  tone: "bad",
  href: "/system/queues",
});
assert.deepEqual(tiles({ exports: { stalled: 0, failed: 4 } })[2], {
  label: "Data export problems",
  count: 4,
  detail: "Failed in the last 7 days",
  tone: "warn",
  href: "/system/queues",
});
assert.equal(tiles({ exports: null })[2].count, null);
assert.equal(tiles({ exports: null })[2].detail, "Could not be read");

console.log("dashboard checks passed");
