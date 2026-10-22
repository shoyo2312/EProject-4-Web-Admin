// Run: node lib/__tests__/notifications.test.mjs
import assert from "node:assert/strict";
import { registerHooks } from "node:module";

// notifications.ts takes targetHref from lib/moderation through the "@/" alias, which only the
// bundler knows. Resolved here the way tsconfig maps it, before the module is loaded.
registerHooks({
  resolve: (specifier, context, next) =>
    next(
      specifier.startsWith("@/") ? new URL(`../../${specifier.slice(2)}.ts`, import.meta.url).href : specifier,
      context,
    ),
});
const {
  buildNotifications,
  countByKind,
  countUnread,
  dayHeading,
  groupByDay,
  heldAt,
  newestAt,
} = await import("../notifications.ts");

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
  review: page([video("r1", { moderation: { checkedAt: daysAgo(2) } }), video("r2", {})]),
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

// Every report opens its target: an account or a video on its page, a comment pinned above its
// video's thread. An id that names no comment goes to the queue instead.
assert.equal(items[0].href, "/users/u1");
assert.equal(items[1].href, "/videos/v1");
assert.equal(items[4].href, "/moderation/reports");
assert.equal(
  buildNotifications({ now, signups: none, uploads: none, review: none, trash: [], queue: [group("COMMENT", "v9:c9", 1, daysAgo(1))] })[0].href,
  "/comments?videoId=v9&comment=c9",
);
// A held video opens the review screen on that video.
assert.equal(items.find((n) => n.id === "review:r1").href, "/moderation/review?video=r1");
assert.equal(items[0].title, "1 report on a user");
assert.equal(items[1].title, "3 reports on a video");

// Unread is strictly newer than what was seen; seeing the newest clears everything.
assert.equal(countUnread(items, 0), items.length);
assert.equal(countUnread(items, Date.parse(daysAgo(1.5))), 3);
assert.equal(countUnread(items, newestAt(items)), 0);
assert.equal(newestAt([]), 0);

const quiet = { now, queue: [], review: none, trash: [], signups: none, uploads: none };
assert.equal(buildNotifications({ ...quiet, limit: 2 }).length, 0);
assert.equal(
  buildNotifications({ ...quiet, review: page([video("a", {}), video("b", {}), video("c", {})]), limit: 2 }).length,
  2,
);

// Past three held videos the feed says how many in one line, dated by the newest hold, rather
// than a near-identical line per video; the line opens the queue at its oldest.
assert.deepEqual(
  buildNotifications({
    ...quiet,
    review: page(
      [
        video("h1", { moderation: { checkedAt: daysAgo(0.2) } }),
        video("h2", { moderation: { checkedAt: daysAgo(0.1) } }),
        video("h3", {}),
        video("h4", {}),
      ],
      21,
    ),
  }),
  [
    {
      id: "review",
      at: daysAgo(0.1),
      kind: "review",
      title: "21 videos waiting for review",
      detail: "Newest: video h2",
      href: "/moderation/review",
    },
  ],
);
assert.equal(
  buildNotifications({ ...quiet, review: page([video("a", {}), video("b", {}), video("c", {}), video("d", {})], 1200) })[0].title,
  "1,200 videos waiting for review",
);
// When a video started waiting: its classifier verdict, else the last write to it.
assert.equal(heldAt(video("x", { moderation: { checkedAt: daysAgo(2) } })), daysAgo(2));
assert.equal(heldAt(video("y", {})), daysAgo(10));

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

// The centre's filter counts each kind present, and only those.
assert.deepEqual(countByKind(items), { report: 3, trash: 1, review: 2 });
assert.deepEqual(countByKind([]), {});

// Grouped by UTC day, newest first, whatever order the items came in.
const at = (iso, id) => ({ id, at: iso, kind: "report", title: id, detail: "", href: "/" });
const grouped = groupByDay([
  at("2026-09-23T23:59:00Z", "late-yesterday"),
  at("2026-09-24T08:00:00Z", "today-morning"),
  at("2026-09-24T11:00:00Z", "today-noon"),
  at("2026-09-20T10:00:00+07:00", "offset"),
]);
assert.deepEqual(
  grouped.map((g) => [g.day, g.items.map((i) => i.id)]),
  [
    ["2026-09-24", ["today-noon", "today-morning"]],
    ["2026-09-23", ["late-yesterday"]],
    ["2026-09-20", ["offset"]],
  ],
);
assert.deepEqual(groupByDay([]), []);

assert.equal(dayHeading("2026-09-24", now), "Today");
assert.equal(dayHeading("2026-09-23", now), "Yesterday");
assert.equal(dayHeading("2026-09-20", now), null, "older days are dated");

console.log("notifications: ok");
