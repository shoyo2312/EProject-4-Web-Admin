// Run: node lib/series.check.mjs
// A wrong delta still renders a confident-looking arrow, which is the whole problem this
// module exists to fix — so the "no comparison possible" cases are the point of the file.
import assert from "node:assert/strict";
import { deltaPercent, spark, sumLast } from "./series.ts";

assert.equal(sumLast([1, 2, 3, 4], 2), 7);
assert.equal(sumLast([1, 2], 10), 3, "asking for more than there is sums what there is");
assert.equal(sumLast([], 3), 0);

// Doubling over the previous period is +100%; halving is -50%.
assert.equal(deltaPercent([10, 10, 20, 20], 2), 100);
assert.equal(deltaPercent([20, 20, 10, 10], 2), -50);
assert.equal(deltaPercent([5, 5, 5, 5], 2), 0, "genuinely flat is 0, not null");

// No comparable history: null, never a number the card would draw an arrow on.
assert.equal(deltaPercent([1, 2, 3], 2), null, "fewer than two full periods");
assert.equal(deltaPercent([], 7), null);
assert.equal(deltaPercent([0, 0, 5, 5], 2), null, "previous period was zero");
assert.equal(deltaPercent([1, 2, 3, 4], 0), null, "a zero-length period compares nothing");

// Only the last 2*size entries take part — older history is not in the comparison.
assert.equal(deltaPercent([99, 99, 10, 20], 1), 100);

// Downsampling never exceeds eight bars, and keeps every value in exactly one of them.
const thirty = Array.from({ length: 30 }, (_, i) => i + 1);
const bars = spark(thirty, 30);
assert.ok(bars.length <= 8, `${bars.length} bars`);
assert.equal(
  bars.reduce((sum, v) => sum + v, 0),
  thirty.reduce((sum, v) => sum + v, 0),
  "bucketing must not lose or double-count a value",
);
assert.deepEqual(spark([1, 2, 3], 10), [1, 2, 3], "fewer than eight passes through");
assert.deepEqual(spark([], 8), []);

console.log("series checks passed");
