// Run: node lib/__tests__/dead-letters.test.mjs
import assert from "node:assert/strict";
import { registerHooks } from "node:module";

registerHooks({
  resolve: (specifier, context, next) =>
    next(
      specifier.startsWith("@/") ? new URL(`../../${specifier.slice(2)}.ts`, import.meta.url).href : specifier,
      context,
    ),
});
const { batchReplaySummary, deadLetterHealth, deadLetterHref, deadLetterStatus, replayOutcomeText } =
  await import("../dead-letters.ts");

// The topic travels whole in the query string, dots and all.
assert.equal(deadLetterHref("video.video-events.DLT"), "/system/queues/dead-letters?topic=video.video-events.DLT");

// Nothing parked, and parked but all handled, say different things.
assert.deepEqual(deadLetterHealth([]), { tone: "ok", text: "Nothing has been dead-lettered." });
assert.deepEqual(deadLetterHealth([{ pending: 0 }]), { tone: "ok", text: "Nothing pending." });

// Pending is counted across topics, and only the topics with some count as waiting.
const health = deadLetterHealth([{ pending: 2 }, { pending: 0 }, { pending: 1 }]);
assert.equal(health.tone, "bad");
assert.match(health.text, /^3 records pending on 2 topics/);
assert.match(deadLetterHealth([{ pending: 1 }]).text, /^1 record pending on 1 topic /);

// The console's own last replay decides the label; without one, pending or not decides it.
const lastReplay = (outcome, forced = false) => ({
  outcome,
  detail: null,
  forced,
  adminId: "1",
  at: "2026-10-24T08:00:00Z",
});
assert.deepEqual(deadLetterStatus({ pending: true, lastReplay: null }), { tone: "bad", label: "Pending" });
assert.deepEqual(deadLetterStatus({ pending: false, lastReplay: null }), {
  tone: "neutral",
  label: "Handled from the CLI",
});
assert.equal(deadLetterStatus({ pending: true, lastReplay: lastReplay("HELD_BACK") }).label, "Held back");
assert.equal(deadLetterStatus({ pending: false, lastReplay: lastReplay("REPLAYED", true) }).label, "Replayed (forced)");
assert.equal(deadLetterStatus({ pending: false, lastReplay: lastReplay("REPLAYED") }).tone, "ok");
assert.equal(deadLetterStatus({ pending: true, lastReplay: lastReplay("NOT_PARKED") }).tone, "neutral");

// A held-back replay names what holds it.
assert.match(
  replayOutcomeText({ outcome: "HELD_BACK", detail: "video.video-events-0@12 holds a later VideoRestoredEvent for key v1" }),
  /^Held back: video\.video-events-0@12 holds a later VideoRestoredEvent/,
);
assert.match(replayOutcomeText({ outcome: "REPLAYED", detail: "video.video-events-0@90" }), /^Replayed to video\.video-events-0@90\./);

// A batch counts each outcome, in a fixed order, and says when another run is needed.
const result = (outcome) => ({ partition: 0, offset: 1, outcome, detail: null });
assert.equal(
  batchReplaySummary({ results: [result("REPLAYED"), result("REPLAYED")], stillPending: 0 }),
  "2 replayed.",
);
assert.equal(
  batchReplaySummary({ results: [result("HELD_BACK"), result("REPLAYED")], stillPending: 4 }),
  "1 replayed, 1 held back. Held-back records stay listed: replay each on its own once you have read what holds it. 4 records still pending — replay again to carry on.",
);
assert.equal(batchReplaySummary({ results: [], stillPending: 0 }), "Nothing was pending.");
assert.match(batchReplaySummary({ results: [], stillPending: 1 }), /1 record still pending\.$/);
