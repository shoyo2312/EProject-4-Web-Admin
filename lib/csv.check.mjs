// Run: node lib/csv.check.mjs
// Guards the quoting rules — getting them wrong shifts columns silently, never throws.
import assert from "node:assert/strict";
import { toCsv, csvColumns, csvFilename } from "./csv.ts";

// A reason field is free text: commas, quotes and newlines all reach it.
assert.equal(
  toCsv([{ id: "1", reason: 'spam, "obviously"' }]),
  'id,reason\r\n1,"spam, ""obviously"""',
);
assert.equal(
  toCsv([{ reason: "line one\nline two" }]),
  'reason\r\n"line one\nline two"',
);

// Null email (social account) is empty, not the string "null".
assert.equal(toCsv([{ email: null, verified: false }]), "email,verified\r\n,false");

// A field only present on a later row still gets a column.
assert.deepEqual(csvColumns([{ a: 1 }, { a: 2, b: 3 }]), ["a", "b"]);
assert.equal(toCsv([{ a: 1 }, { a: 2, b: 3 }]), "a,b\r\n1,\r\n2,3");

// Leading whitespace survives Excel only when quoted.
assert.equal(toCsv([{ a: " x" }]), 'a\r\n" x"');

// Header only, so an empty export is still a valid file.
assert.equal(toCsv([], ["a", "b"]), "a,b");

assert.equal(csvFilename("users", new Date("2026-09-06T12:00:00Z")), "users-2026-09-06.csv");

console.log("csv checks passed");

// Date rendering: DD/MM/YYYY, zero-padded, never the browser's guess.
const { formatDate } = await import("./format.ts");
assert.equal(formatDate("2026-09-06"), "06/09/2026");
assert.equal(formatDate("2026-12-31T23:00:00Z"), "31/12/2026");
console.log("date format checks passed");
