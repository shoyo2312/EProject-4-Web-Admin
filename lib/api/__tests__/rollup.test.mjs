// Run: node lib/api/__tests__/rollup.test.mjs
import assert from "node:assert/strict";
import { engagementByDay } from "../rollup.ts";

const rows = [
  { day: "2026-08-01", eventType: "LIKED", count: 5 },
  { day: "2026-08-01", eventType: "UNLIKED", count: 2 },
  { day: "2026-08-01", eventType: "COMMENTED", count: 1 },
  { day: "2026-08-01", eventType: "SHARED", count: 1 },
  // An upload is not engagement, whatever day it lands on.
  { day: "2026-08-01", eventType: "PUBLISHED", count: 9 },
  // More unlikes than likes nets to zero likes, not to a negative that eats the comments.
  { day: "2026-08-02", eventType: "LIKED", count: 1 },
  { day: "2026-08-02", eventType: "UNLIKED", count: 4 },
  { day: "2026-08-02", eventType: "COMMENTED", count: 2 },
  { day: "2026-08-03", eventType: "PUBLISHED", count: 3 },
];

const byDay = Object.fromEntries(engagementByDay(rows).map((d) => [d.day, d.events]));
// Likes net of unlikes, plus comments and shares — what the trend chart draws for the same day.
assert.equal(byDay["2026-08-01"], 5 - 2 + 1 + 1);
assert.equal(byDay["2026-08-02"], 2);
assert.equal(byDay["2026-08-03"], 0, "a day of uploads only is a day of no engagement");

console.log("rollup checks passed");
