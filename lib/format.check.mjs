// Run: node lib/format.check.mjs
// Guards the percentages on the video and analytics pages — a 0% for "nothing to divide by", or a
// small rate rounded down to 0%, both read as a real measurement.
import assert from "node:assert/strict";
import { formatPercent } from "./format.ts";

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

console.log("format checks passed");
