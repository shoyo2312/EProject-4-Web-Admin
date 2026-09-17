// Run: node lib/window.check.mjs
// The bucketing is where a wrong answer still renders a plausible-looking chart.
import assert from "node:assert/strict";
import {
  bucketByGranularity,
  daysBetween,
  parseAsOf,
  parseGranularity,
  parsePage,
  resolveWindow,
  sliceToWindow,
} from "./api/window.ts";

const LATEST = "2026-08-13";

// A future or malformed date must fall back, never reach the API as negative days.
assert.equal(parseAsOf("2027-01-01", LATEST), LATEST);
assert.equal(parseAsOf("not-a-date", LATEST), LATEST);
assert.equal(parseAsOf(undefined, LATEST), LATEST);
assert.equal(parseAsOf("13/08/2026", LATEST), LATEST);
assert.equal(parseAsOf("2026-07-01", LATEST), "2026-07-01");
assert.equal(parseGranularity("yearly"), "daily");

// ?page= is one-based and hand-editable; nothing but a real page may reach the backend,
// where a negative offset is a 400 and a fractional one is a silently different query.
assert.equal(parsePage(undefined), 0);
assert.equal(parsePage("1"), 0);
assert.equal(parsePage("3"), 2);
assert.equal(parsePage("0"), 0);
assert.equal(parsePage("-2"), 0);
assert.equal(parsePage("1.5"), 0);
assert.equal(parsePage("banana"), 0);
assert.equal(parsePage(""), 0);

assert.equal(daysBetween("2026-08-01", "2026-08-13"), 12);
assert.equal(daysBetween("2026-08-13", "2026-08-01"), 0, "never negative");

// Picking a date a month back must widen the request, not shift a fixed-size one.
const back = resolveWindow({ asOf: "2026-07-14" }, LATEST);
assert.equal(back.spanDays, 30);
assert.equal(back.fetchDays, 30 + 30);
assert.equal(resolveWindow({ g: "monthly" }, LATEST).spanDays, 365);

const days = Array.from({ length: 40 }, (_, i) => ({
  day: new Date(Date.UTC(2026, 6, 5 + i)).toISOString().slice(0, 10),
  n: 1,
}));

const win = resolveWindow({ asOf: "2026-08-01" }, LATEST);
const sliced = sliceToWindow(days, win);
assert.equal(sliced.at(-1).day, "2026-08-01", "window ends on the picked date");
assert.ok(sliced.length <= 30);

// Weekly chunks run back from the end, so the newest bar is always a full week.
const weekly = bucketByGranularity(days.slice(0, 21), "weekly", (a, b) => ({
  day: a.day,
  n: a.n + b.n,
}));
assert.deepEqual(weekly.map((b) => b.n), [7, 7, 7]);
assert.equal(weekly.at(-1).day, "2026-07-19");

// A leading part-week stays its own bar rather than being folded into a full one.
const partial = bucketByGranularity(days.slice(0, 9), "weekly", (a, b) => ({
  day: a.day,
  n: a.n + b.n,
}));
assert.deepEqual(partial.map((b) => b.n), [2, 7]);

const monthly = bucketByGranularity(days, "monthly", (a, b) => ({
  day: a.day,
  n: a.n + b.n,
}));
assert.deepEqual(monthly.map((b) => [b.day.slice(0, 7), b.n]), [
  ["2026-07", 27],
  ["2026-08", 13],
]);

assert.deepEqual(bucketByGranularity([], "weekly", (a) => a), []);
assert.deepEqual(bucketByGranularity(days, "daily", (a) => a), days);

console.log("window checks passed");
