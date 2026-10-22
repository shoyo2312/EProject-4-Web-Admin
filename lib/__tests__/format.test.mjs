// Run: node lib/__tests__/format.test.mjs
// Guards the percentages on the video and analytics pages — a 0% for "nothing to divide by", or a
// small rate rounded down to 0%, both read as a real measurement.
import assert from "node:assert/strict";
import { daysUntilPurge, formatPercent, formatSpan, plural, timeLeft } from "../format.ts";

// One is the only singular — "0 reports", "1 report", "2 reports" — and irregular plurals are given.
assert.equal(plural(1, "report"), "report");
assert.equal(plural(0, "report"), "reports");
assert.equal(plural(2, "report"), "reports");
assert.equal(plural(3, "reply", "replies"), "replies");
assert.equal(plural(1, "reply", "replies"), "reply");

assert.equal(formatPercent(1, 3), "33%");
assert.equal(formatPercent(70, 1000), "7%");
assert.equal(formatPercent(45, 1000), "4.5%");
// Under 10% keeps a decimal: a whole percent would show a real 0.4% engagement as 0%.
assert.equal(formatPercent(4, 1000), "0.4%");
// Nobody engaged is a measured zero, not missing data.
assert.equal(formatPercent(0, 1000), "0%");
// No views means there is no rate at all — not 0%, and not Infinity%.
assert.equal(formatPercent(5, 0), "—");
// Not clamped: the two counts can come from different services, and hiding a disagreement would
// make the figure look more trustworthy than it is.
assert.equal(formatPercent(130, 100), "130%");

// Measured against the clock it is handed, not the wall clock: in mock mode the trash table and a
// video's own page have to agree on the same mock date.
const DAY = 86_400_000;
const deletedAt = "2026-09-01T00:00:00Z";
const at = (days) => Date.parse(deletedAt) + days * DAY;
assert.equal(daysUntilPurge(deletedAt, 30, at(0)), "30 days");
assert.equal(daysUntilPurge(deletedAt, 30, at(27.5)), "3 days");
assert.equal(daysUntilPurge(deletedAt, 30, at(29)), "1 day", "one day left is not \"1 days\"");
assert.equal(daysUntilPurge(deletedAt, 30, at(29.5)), "less than a day");
assert.equal(daysUntilPurge(deletedAt, 30, at(31)), "less than a day", "overdue is not negative");

// What a restriction has left, against the clock it is handed — the mock clock in mock mode.
{
  const now = Date.parse("2026-10-15T08:00:00Z");
  const after = (ms) => new Date(now + ms).toISOString();
  assert.equal(timeLeft(after(45 * 60_000), now), "45m");
  assert.equal(timeLeft(after(30_000), now), "1m", "seconds to go is not \"0m\"");
  assert.equal(timeLeft(after(5 * 3_600_000), now), "5h");
  assert.equal(timeLeft(after(7 * DAY), now), "7d");
  assert.equal(timeLeft(after(-60_000), now), "1m", "already over is not negative");
}

// The same words for a span with no instant behind it, such as how long decisions take.
assert.equal(formatSpan(45 * 60_000), "45m");
assert.equal(formatSpan(30_000), "1m");
assert.equal(formatSpan(5 * 3_600_000), "5h");
assert.equal(formatSpan(3 * DAY), "3d");

console.log("format checks passed");
