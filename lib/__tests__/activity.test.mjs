// Run: node lib/__tests__/activity.test.mjs
//
// The merge is the whole module: five sources, one order, and a de-duplication that decides
// whether a ban shows up once or twice. All of it fails silently — a timeline that drops an
// event or doubles one still renders a confident-looking list — so these are the cases that
// say it is actually merging rather than merely concatenating.
import assert from "node:assert/strict";
import {
  buildUserActivity,
  filterActivity,
  pageOfActivity,
  parseActivityFilter,
} from "../activity.ts";

const user = {
  id: "u1",
  username: "nora",
  email: "nora@example.test",
  role: "USER",
  status: "ACTIVE",
  emailVerified: true,
  emailVerifiedAt: "2026-03-02T10:00:00Z",
  createdAt: "2026-03-01T09:00:00Z",
  updatedAt: "2026-09-20T09:00:00Z",
  lastLoginAt: "2026-09-19T20:00:00Z",
  bannedAt: null,
  bannedUntil: null,
  banReason: null,
  provider: null,
  linkedProviders: [],
};

const video = {
  id: "v1",
  userId: "u1",
  title: "morning run",
  description: null,
  thumbnailUrl: null,
  previewUrl: null,
  hlsUrl: null,
  durationSeconds: 30,
  status: "PUBLISHED",
  visibility: "PUBLIC",
  viewCount: 0,
  likeCount: 0,
  commentCount: 0,
  commentsDisabled: false,
  tags: [],
  createdAt: "2026-05-10T12:00:00Z",
  updatedAt: "2026-05-10T12:05:00Z",
  publishedAt: "2026-05-10T12:05:00Z",
  rawFileUrl: null,
  failureReason: null,
  takedownReason: null,
  deletedAt: null,
};

const action = {
  id: "a1",
  adminId: "900000000123456",
  actionType: "BAN_USER",
  targetType: "USER",
  targetId: "u1",
  reason: "Repeated policy violations",
  reportId: null,
  createdAt: "2026-09-20T08:00:00Z",
};

const report = {
  id: "r1",
  reporterId: "800000000654321",
  targetType: "VIDEO",
  targetId: "v9",
  reason: "Spam",
  status: "PENDING",
  resolvedBy: null,
  resolvedAt: null,
  createdAt: "2026-06-01T11:00:00Z",
};

const empty = { actions: [], uploads: [], reportsFiled: [], reportsReceived: [] };
const build = (over = {}) => buildUserActivity({ user, ...empty, ...over });

// --- the merge ----------------------------------------------------------------------------

// Every source contributes, and the result is one list in one order — not five lists in a row.
const all = build({
  actions: [action],
  uploads: [video],
  reportsFiled: [report],
  reportsReceived: [{ ...report, id: "r2", targetType: "USER", targetId: "u1" }],
});
assert.deepEqual(
  all.map((e) => e.kind),
  [
    "moderation.ban_user", // Sep 20
    "account.last_login", // Sep 19
    "report.filed", // r1 and r2 share an instant; id breaks the tie
    "report.received",
    "video.uploaded", // May 10
    "account.email_verified", // Mar 2
    "account.created", // Mar 1
  ],
  "newest first, across every source",
);

// Ties are broken by id rather than left to sort stability, so two events at the same instant
// come back in the same order on every render.
assert.deepEqual(
  build({
    reportsFiled: [
      { ...report, id: "r-b" },
      { ...report, id: "r-a" },
    ],
  }).map((e) => e.id),
  [
    "account.last_login",
    "report.filed.r-a",
    "report.filed.r-b",
    "account.email_verified",
    "account.created",
  ],
);

// --- what each source produces ------------------------------------------------------------

// A deleted upload is two events, not one: it was uploaded and then it was deleted.
assert.deepEqual(
  build({ uploads: [{ ...video, deletedAt: "2026-07-04T08:00:00Z" }] })
    .filter((e) => e.category === "content")
    .map((e) => e.kind),
  ["video.deleted", "video.uploaded"],
);

// A takedown is moderation, not content, and is dated by updatedAt — which is a proxy, so the
// row has to say so rather than presenting a guess as a recorded moment.
const takenDown = build({
  uploads: [{ ...video, status: "TAKEN_DOWN", takedownReason: "Graphic violence" }],
});
const takedownRow = takenDown.find((e) => e.kind === "video.taken_down");
assert.equal(takedownRow.category, "moderation");
assert.equal(takedownRow.approximate, true, "an inferred timestamp must be marked");
assert.equal(takedownRow.detail, "Graphic violence");
assert.equal(
  takenDown.find((e) => e.kind === "video.uploaded").approximate,
  undefined,
  "a recorded timestamp is not marked",
);

// An account with no optional fields set still has a history: it was registered.
assert.deepEqual(
  buildUserActivity({
    user: { ...user, emailVerifiedAt: null, lastLoginAt: null },
    ...empty,
  }).map((e) => e.kind),
  ["account.created"],
);

// --- the ban de-duplication ---------------------------------------------------------------

// A ban that has its audit action appears once — as the action, which names the admin and why.
const deduped = buildUserActivity({
  user: { ...user, status: "BANNED", bannedAt: "2026-09-20T08:00:30Z", banReason: "spam" },
  ...empty,
  actions: [action], // 30s earlier: one decision, two services' clocks
});
assert.equal(
  deduped.filter((e) => e.kind === "account.banned").length,
  0,
  "the audit action stands in for the ban; two rows for one decision is a false trail",
);
assert.equal(deduped.filter((e) => e.kind === "moderation.ban_user").length, 1);

// A ban with no audit action behind it is still shown — that is the case a compliance trail
// most needs, and dropping it would hide an unexplained enforcement.
const orphanBan = buildUserActivity({
  user: { ...user, status: "BANNED", bannedAt: "2026-09-20T08:00:00Z", banReason: "spam" },
  ...empty,
});
assert.equal(orphanBan.filter((e) => e.kind === "account.banned").length, 1);

// Far enough apart and they are two different decisions, not one recorded twice.
assert.equal(
  buildUserActivity({
    user: { ...user, status: "BANNED", bannedAt: "2026-09-25T08:00:00Z", banReason: "again" },
    ...empty,
    actions: [action], // five days earlier
  }).filter((e) => e.kind === "account.banned").length,
  1,
);

// A temporary ban reads as a suspension, a permanent one as a ban.
const suspended = buildUserActivity({
  user: {
    ...user,
    status: "BANNED",
    bannedAt: "2026-09-20T08:00:00Z",
    bannedUntil: "2026-10-20T08:00:00Z",
  },
  ...empty,
});
assert.equal(suspended.find((e) => e.kind === "account.banned").summary, "Account suspended");
assert.equal(
  orphanBan.find((e) => e.kind === "account.banned").summary,
  "Account banned permanently",
);

// --- the security log -----------------------------------------------------------------------

const signIn = {
  id: "s1",
  eventType: "LOGIN_SUCCEEDED",
  ipAddress: "203.0.113.7",
  userAgent: "Mozilla/5.0 (Macintosh) Chrome/140.0.0.0 Safari/537.36",
  deviceLabel: "Chrome on macOS",
  detail: null,
  createdAt: "2026-09-19T20:05:00Z",
};

// The device and the address are what make a sign-in worth recording, so they have to survive
// the mapping — an entry that says only "Signed in" is the last_login field again.
const mapped = build({ securityEvents: [signIn] }).find((e) => e.kind === "security.login_succeeded");
assert.equal(mapped.summary, "Signed in");
assert.equal(mapped.category, "security");
assert.equal(mapped.detail, "Chrome on macOS · 203.0.113.7");

// lastLoginAt is a stand-in for a log that did not exist. With real sign-ins present it would put
// one sign-in in the timeline twice, minutes apart, which reads as two.
assert.equal(
  build({ securityEvents: [signIn] }).filter((e) => e.kind === "account.last_login").length,
  0,
  "the recorded sign-in stands in for lastLoginAt, not beside it",
);

// ...but an account whose log holds no sign-in still has that one timestamp, and dropping it
// would silently lose the only evidence the account was ever used.
assert.equal(
  build({ securityEvents: [{ ...signIn, eventType: "LOGOUT" }] })
    .filter((e) => e.kind === "account.last_login").length,
  1,
);
assert.equal(build().filter((e) => e.kind === "account.last_login").length, 1);

// An account under a password-guessing run: the newest page of its log is all failures, and the
// sign-ins sit further back. The stand-in still shows, but must not claim the log has none.
const failure = { ...signIn, eventType: "LOGIN_FAILED" };
const lastLogin = (securityLogTruncated) =>
  build({ securityEvents: [failure], securityLogTruncated })
    .find((e) => e.kind === "account.last_login");
assert.match(lastLogin(false).detail, /No sign-in recorded in the security log/);
assert.doesNotMatch(lastLogin(true).detail, /recorded in the security log/);
assert.match(lastLogin(true).detail, /older entries were not fetched/);

// Same rule for the other stand-in.
assert.equal(
  build({ securityEvents: [{ ...signIn, id: "s2", eventType: "EMAIL_VERIFIED" }] })
    .filter((e) => e.kind === "account.email_verified").length,
  0,
);
assert.equal(build().filter((e) => e.kind === "account.email_verified").length, 1);

// A kind auth-service ships before the console learns it still draws a row, named as it came.
const unknown = build({ securityEvents: [{ ...signIn, id: "s3", eventType: "PHONE_CHANGED" }] })
  .find((e) => e.kind === "security.phone_changed");
assert.equal(unknown.summary, "PHONE_CHANGED", "an unmapped kind must not render an empty row");

// Nothing recorded at all is the account that predates the log, not an error.
assert.deepEqual(
  build({ securityEvents: [] }).map((e) => e.kind),
  ["account.last_login", "account.email_verified", "account.created"],
);

// The log merges into the same order as everything else rather than sitting in its own block.
assert.deepEqual(
  build({
    uploads: [video],
    securityEvents: [signIn, { ...signIn, id: "s4", createdAt: "2026-04-01T09:00:00Z" }],
  }).map((e) => e.kind),
  [
    "security.login_succeeded", // Sep 19
    "video.uploaded", // May 10
    "security.login_succeeded", // Apr 1
    "account.email_verified", // Mar 2
    "account.created", // Mar 1
  ],
);

// --- filtering -----------------------------------------------------------------------------

assert.equal(filterActivity(all, "all").length, all.length);
assert.deepEqual(
  filterActivity(all, "content").map((e) => e.kind),
  ["video.uploaded"],
);
assert.ok(filterActivity(all, "security").every((e) => e.category === "security"));

assert.equal(parseActivityFilter("content"), "content");
assert.equal(parseActivityFilter(undefined), "all");
assert.equal(parseActivityFilter("nonsense"), "all", "a hand-typed query value never throws");
assert.equal(parseActivityFilter("__proto__"), "all");

// --- paging --------------------------------------------------------------------------------

const rows = Array.from({ length: 7 }, (_, i) => ({ id: `e${i}` }));
assert.deepEqual(
  pageOfActivity(rows, 0, 3).rows.map((r) => r.id),
  ["e0", "e1", "e2"],
);
assert.deepEqual(
  pageOfActivity(rows, 2, 3).rows.map((r) => r.id),
  ["e6"],
);
assert.equal(pageOfActivity(rows, 0, 3).totalPages, 3);
assert.equal(pageOfActivity(rows, 0, 3).totalElements, 7);

// Switching to a narrower filter while on a late page must not land on nothing: the slice
// clamps to the last page that exists and reports where it actually landed.
const clamped = pageOfActivity(rows, 9, 3);
assert.equal(clamped.page, 2);
assert.deepEqual(
  clamped.rows.map((r) => r.id),
  ["e6"],
);

// An empty list is one empty page, not zero pages — the pager renders "Page 1 of 1".
const none = pageOfActivity([], 0, 3);
assert.equal(none.totalPages, 1);
assert.equal(none.totalElements, 0);
assert.deepEqual(none.rows, []);

console.log("activity checks passed");
