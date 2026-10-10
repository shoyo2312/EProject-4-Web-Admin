// Run: node lib/api/__tests__/json.test.mjs
import assert from "node:assert/strict";
import { parseWithLongIdsAsStrings as parse } from "../json.ts";

// Snowflake ids come back as strings, digit for digit, wherever they sit.
assert.deepEqual(parse('{"id":7250000000000012345}'), { id: "7250000000000012345" });
assert.deepEqual(parse('{"id": -7250000000000012345 }'), { id: "-7250000000000012345" });
assert.deepEqual(
  parse('{"ids":[7250000000000012345, 7250000000000012346]}'),
  { ids: ["7250000000000012345", "7250000000000012346"] },
  "ids in an array too",
);
assert.equal(parse("7250000000000012345"), "7250000000000012345");

// Digits inside text are text: a title like this one broke every listing that showed it.
assert.deepEqual(
  parse('{"title":"Order: 1234567890123456, thanks","ownerId":7250000000000012345}'),
  { title: "Order: 1234567890123456, thanks", ownerId: "7250000000000012345" },
);
assert.deepEqual(
  parse('{"text":"a \\": 1234567890123456789} \\\\","n":1}'),
  { text: 'a ": 1234567890123456789} \\', n: 1 },
  "escaped quotes and backslashes do not end the string early",
);

// Everything else stays a number: counts, epoch millis, a score's seventeen decimals.
assert.deepEqual(
  parse('{"views":123,"at":1759900000000,"maxScore":0.30000000000000004,"tiny":5e-12345678901234567}'),
  { views: 123, at: 1759900000000, maxScore: 0.30000000000000004, tiny: 0 },
);

console.log("json checks passed");
