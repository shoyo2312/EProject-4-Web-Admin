// Run: node lib/__tests__/sort.test.mjs
import assert from "node:assert/strict";
import { nextSort, sortRows } from "../sort.ts";

// A new column starts high to low; the same column flips; another column starts over.
assert.deepEqual(nextSort(undefined, "views"), { field: "views", ascending: false });
assert.deepEqual(nextSort({ field: "views", ascending: false }, "views"), { field: "views", ascending: true });
assert.deepEqual(nextSort({ field: "views", ascending: true }, "views"), { field: "views", ascending: false });
assert.deepEqual(nextSort({ field: "views", ascending: true }, "likes"), { field: "likes", ascending: false });

const rows = [{ n: 2, s: "b" }, { n: null, s: null }, { n: 10, s: "a" }, { n: 1, s: "c" }];

// Numbers compare as numbers, not as text ("10" < "2").
assert.deepEqual(sortRows(rows, (r) => r.n, true).map((r) => r.n), [1, 2, 10, null]);
assert.deepEqual(sortRows(rows, (r) => r.n, false).map((r) => r.n), [10, 2, 1, null]);
assert.deepEqual(sortRows(rows, (r) => r.s, true).map((r) => r.s), ["a", "b", "c", null]);

// The input is left as it was.
assert.deepEqual(rows.map((r) => r.n), [2, null, 10, 1]);
