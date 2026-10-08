// Run: node lib/window.check.mjs
// The bucketing is where a wrong answer still renders a plausible-looking chart.
import assert from "node:assert/strict";
import {
  bucketByGranularity,
  bucketMean,
  daysBetween,
  historyUpTo,
  inPeriod,
  parseAsOf,
  parsePage,
  parsePeriod,
  resolveWindow,
  sliceToWindow,
  windowRange,
} from "./api/window.ts";
import { sumLast } from "./series.ts";

const LATEST = "2026-08-13";

// A future or malformed date must fall back, never reach the API as negative days.
assert.equal(parseAsOf("2027-01-01", LATEST), LATEST);
assert.equal(parseAsOf("not-a-date", LATEST), LATEST);
assert.equal(parseAsOf(undefined, LATEST), LATEST);
assert.equal(parseAsOf("13/08/2026", LATEST), LATEST);
assert.equal(parseAsOf("2026-07-01", LATEST), "2026-07-01");
assert.equal(parsePeriod("yearly"), "month");

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
assert.equal(back.chartDays, 365);
assert.equal(back.fetchDays, 30 + 365);
assert.equal(back.historyDays, 365);
assert.equal(resolveWindow({ p: "year" }, LATEST).chartDays, 365);

const days = Array.from({ length: 40 }, (_, i) => ({
  day: new Date(Date.UTC(2026, 6, 5 + i)).toISOString().slice(0, 10),
  n: 1,
}));

const win = resolveWindow({ p: "day", asOf: "2026-08-01" }, LATEST);
const sliced = sliceToWindow(days, win, (day) => ({ day, n: 0 }));
assert.equal(sliced.at(-1).day, "2026-08-01", "window ends on the picked date");
assert.equal(sliced.length, win.chartDays);

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

// The daily endpoints send no row for an empty day. "The last 7" has to mean seven calendar
// days, or uploads from ten days back land in this week.
const sparse = [
  { day: "2026-08-03", n: 3 },
  { day: "2026-08-13", n: 1 },
];
const week = resolveWindow({ p: "week" }, LATEST);
const filled = historyUpTo(sparse, week, (d) => d.n);
assert.equal(filled.length, week.historyDays);
assert.equal(filled.at(-1), 1, "ends on the picked date");
assert.equal(filled.at(-11), 3, "a row lands on its own day, not the slot after the last one");
assert.equal(sumLast(filled, 7), 1);
assert.equal(sumLast(filled, 14), 4);

// An earlier date drops the rows after it and still ends on that date.
const earlier = historyUpTo(sparse, resolveWindow({ p: "week", asOf: "2026-08-10" }, LATEST), (d) => d.n);
assert.equal(earlier.at(-1), 0);
assert.equal(earlier.at(-8), 3);
assert.equal(earlier.reduce((sum, v) => sum + v, 0), 3);

// Past the API's reach there is nothing fetched to fill, so no zeros get invented either.
assert.deepEqual(historyUpTo(sparse, resolveWindow({ p: "year", asOf: "2023-01-01" }, LATEST), (d) => d.n), []);

// The chart is laid on the same calendar, so "last 30d" is thirty days whatever was sent — the
// KPI above it sums those same days. Taking the last thirty rows would reach back to July.
const thirty = resolveWindow({ p: "day" }, LATEST);
const drawn = sliceToWindow(sparse, thirty, (day) => ({ day, n: 0 }));
assert.equal(drawn.length, 30);
assert.equal(drawn[0].day, "2026-07-15");
assert.equal(drawn.at(-1).day, LATEST);
assert.equal(
  drawn.reduce((sum, d) => sum + d.n, 0),
  sumLast(historyUpTo(sparse, thirty, (d) => d.n), 30),
);

// Weekly bars over the filled series are whole weeks, not seven rows that happened to arrive.
assert.deepEqual(
  bucketByGranularity(drawn, "weekly", (a, b) => ({ day: a.day, n: a.n + b.n })).map((b) => b.n),
  [0, 0, 0, 3, 1],
);
assert.deepEqual(
  sliceToWindow(sparse, resolveWindow({ p: "year", asOf: "2023-01-01" }, LATEST), () => null),
  [],
);

// A period as instants: [first day 00:00Z, the day after asOf 00:00Z), so the rows a log
// returns for it are the same days its daily KPI figures sum.
assert.deepEqual(windowRange(resolveWindow({ p: "day", asOf: "2026-08-12" }, LATEST)), {
  from: "2026-08-12T00:00:00.000Z",
  to: "2026-08-13T00:00:00.000Z",
});
assert.deepEqual(windowRange(resolveWindow({ p: "week", asOf: LATEST }, LATEST)), {
  from: "2026-08-07T00:00:00.000Z",
  to: "2026-08-14T00:00:00.000Z",
});
// Thirty days back across a short February, not "the same date last month".
assert.deepEqual(windowRange(resolveWindow({ p: "month", asOf: "2026-03-01" }, LATEST)), {
  from: "2026-01-31T00:00:00.000Z",
  to: "2026-03-02T00:00:00.000Z",
});

// A daily level averages into its bucket rather than summing: two weeks of 10 and 20 active users
// a day are weeks of 10 and 20, not 70 and 140.
const levels = Array.from({ length: 14 }, (_, i) => ({
  day: `2026-08-${String(i + 1).padStart(2, "0")}`,
  users: i < 7 ? 10 : 20,
}));
assert.deepEqual(bucketMean(levels, "weekly", (d) => d.users).map((b) => b.value), [10, 20]);
assert.deepEqual(
  bucketMean(levels.slice(0, 3), "daily", (d) => d.users),
  [
    { day: "2026-08-01", value: 10 },
    { day: "2026-08-02", value: 10 },
    { day: "2026-08-03", value: 10 },
  ],
  "daily buckets are the days themselves",
);
// A short first bucket is averaged over the days it has: three days of 10 are 10, not 30 spread
// over a whole week as 4.
assert.deepEqual(bucketMean(levels.slice(4), "weekly", (d) => d.users).map((b) => b.value), [10, 20]);

// The period's own days, ending at asOf and inclusive of both ends.
const month = resolveWindow({ p: "month", asOf: "2026-08-13" }, LATEST);
assert.equal(inPeriod("2026-08-13", month), true);
assert.equal(inPeriod("2026-07-15", month), true, "the 30th day back is inside");
assert.equal(inPeriod("2026-07-14", month), false);
assert.equal(inPeriod("2026-08-14", month), false, "after asOf is outside");
const day = resolveWindow({ p: "day", asOf: "2026-08-13" }, LATEST);
assert.equal(inPeriod("2026-08-13", day), true);
assert.equal(inPeriod("2026-08-12", day), false);

console.log("window checks passed");
