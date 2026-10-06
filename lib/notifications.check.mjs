// Run: node lib/notifications.check.mjs
import assert from "node:assert/strict";
import { buildNotifications, countUnread, newestAt } from "./notifications.ts";

const DAY = 86_400_000;
const now = Date.parse("2026-09-24T12:00:00Z");
const daysAgo = (d) => new Date(now - d * DAY).toISOString();

const group = (targetType, targetId, reportCount, lastReportedAt) => ({
  targetType,
  targetId,
  reportCount,
  firstReportedAt: lastReportedAt,
  lastReportedAt,
  latestReason: "Spam",
  severity: 2,
  priority: reportCount * 2,
});
const video = (id, extra) => ({
  id,
  title: `video ${id}`,
  updatedAt: daysAgo(10),
  moderation: null,
  deletedAt: null,
  ...extra,
});
const page = (content, totalElements = content.length) => ({ content, totalElements });
const none = page([]);
const user = (username, createdAt) => ({ id: username, username, createdAt });

const items = buildNotifications({
  now,
  signups: none,
  uploads: none,
  queue: [
    group("VIDEO", "v1", 3, daysAgo(1)),
    group("USER", "u1", 1, daysAgo(0.5)),
    group("COMMENT", "c1", 2, daysAgo(4)),
  ],
  review: [video("r1", { moderation: { checkedAt: daysAgo(2) } }), video("r2", {})],
  trash: [
    video("t-soon", { deletedAt: daysAgo(28) }),
    video("t-fresh", { deletedAt: daysAgo(5) }),
  ],
});

// Newest first across every source; a trashed video only once it's inside the warning window.
assert.deepEqual(
  items.map((n) => n.id),
  ["report:USER:u1", "report:VIDEO:v1", "trash:t-soon", "review:r1", "report:COMMENT:c1", "review:r2"],
);
assert.equal(items.find((n) => n.id === "trash:t-soon").at, daysAgo(1));

// Targets with a detail page link to it; comments have none, so they go to the queue.
assert.equal(items[0].href, "/users/u1");
assert.equal(items[1].href, "/videos/v1");
assert.equal(items[4].href, "/moderation/reports");
assert.equal(items[0].title, "1 report on a user");
assert.equal(items[1].title, "3 reports on a video");

// Unread is strictly newer than what was seen; seeing the newest clears everything.
assert.equal(countUnread(items, 0), items.length);
assert.equal(countUnread(items, Date.parse(daysAgo(1.5))), 3);
assert.equal(countUnread(items, newestAt(items)), 0);
assert.equal(newestAt([]), 0);

const quiet = { now, queue: [], review: [], trash: [], signups: none, uploads: none };
assert.equal(buildNotifications({ ...quiet, limit: 2 }).length, 0);
assert.equal(
  buildNotifications({ ...quiet, review: [video("a", {}), video("b", {}), video("c", {})], limit: 2 }).length,
  2,
);

// Arrivals are counted back 24 hours over a newest-first page, one item per listing, dated by the
// newest arrival so each new one marks the item unread again. Exactly 24 hours old is outside.
const arrivals = buildNotifications({
  ...quiet,
  signups: page([user("newest", daysAgo(0.1)), user("second", daysAgo(0.9)), user("edge", daysAgo(1))], 40),
  uploads: page([video("u1", { createdAt: daysAgo(0.25) }), video("u0", { createdAt: daysAgo(3) })], 12),
});
assert.deepEqual(arrivals, [
  {
    id: "signups",
    at: daysAgo(0.1),
    kind: "signup",
    title: "2 new users in the last 24 hours",
    detail: "Newest: @newest",
    href: "/users",
  },
  {
    id: "uploads",
    at: daysAgo(0.25),
    kind: "upload",
    title: "1 new video in the last 24 hours",
    detail: "Newest: video u1",
    href: "/videos",
  },
]);

// A page that ends still inside the window only gives a lower bound.
const busy = buildNotifications({
  ...quiet,
  signups: page([user("a", daysAgo(0.1)), user("b", daysAgo(0.2))], 9),
});
assert.equal(busy[0].title, "2+ new users in the last 24 hours");

assert.equal(
  buildNotifications({ ...quiet, signups: page([user("old", daysAgo(2))], 30) }).length,
  0,
);

console.log("notifications: ok");
