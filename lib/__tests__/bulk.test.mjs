// Run: node lib/__tests__/bulk.test.mjs
import assert from "node:assert/strict";
import { registerHooks } from "node:module";

registerHooks({
  resolve: (specifier, context, next) =>
    next(
      specifier.startsWith("@/") ? new URL(`../../${specifier.slice(2)}.ts`, import.meta.url).href : specifier,
      context,
    ),
});
const { BULK_MAX, bulkSummary, cleanReason, plainIds, queueTargets, runEach } = await import(
  "../bulk.ts"
);

// One call at a time and in order — every server-side call shares the gateway's rate limit — and
// one failure does not stop the rest.
{
  let inFlight = 0;
  let most = 0;
  const seen = [];
  const outcome = await runEach(["a", "b", "c"], async (id) => {
    inFlight += 1;
    most = Math.max(most, inFlight);
    seen.push(id);
    await new Promise((resolve) => setTimeout(resolve, 1));
    inFlight -= 1;
    if (id === "b") throw new Error("gateway said no");
  });
  assert.deepEqual(seen, ["a", "b", "c"]);
  assert.equal(most, 1);
  assert.deepEqual(outcome, { done: 2, failed: [{ id: "b", message: "gateway said no" }] });
}

// A refusal that applies to every call — signed out, not allowed, rate-limited — stops the run:
// the rest would fail the same way and spend the gateway's budget doing it.
{
  const calls = [];
  const outcome = await runEach(["a", "b", "c"], async (id) => {
    calls.push(id);
    if (id === "b") throw Object.assign(new Error("Too many requests."), { status: 429 });
  });
  assert.deepEqual(calls, ["a", "b"]);
  assert.deepEqual(outcome, {
    done: 1,
    failed: [
      { id: "b", message: "Too many requests." },
      { id: "c", message: "Too many requests." },
    ],
  });
}

assert.equal(bulkSummary({ done: 3, failed: [] }, "Approved", "video"), "Approved 3 videos.");
assert.equal(bulkSummary({ done: 1, failed: [] }, "Banned", "account"), "Banned 1 account.");
assert.equal(
  bulkSummary({ done: 2, failed: [{ id: "b", message: "gateway said no" }] }, "Approved", "video"),
  "Approved 2 of 3 videos. 1 failed: gateway said no.",
);
assert.equal(
  bulkSummary({ done: 0, failed: [{ id: "b", message: "Not found." }] }, "Approved", "video"),
  "Approved 0 of 1 video. 1 failed: Not found.",
);

// One audit entry per account or video, however many times the request names it.
assert.deepEqual(plainIds(["7", "7", "8"]), ["7", "8"]);

// admin-service refuses a blank reason or one past 1,000 characters — for every call alike.
assert.equal(cleanReason("  Spam or scam  "), "Spam or scam");
assert.equal(cleanReason("   "), null);
assert.equal(cleanReason("x".repeat(1001)), null);
assert.equal(cleanReason("x".repeat(1000)), "x".repeat(1000));
assert.equal(cleanReason(42), null);

// Ids end up in a gateway path, so a server action takes plain ids only, and no more than a page.
assert.deepEqual(plainIds(["371162186579881984", "65f1c0ffee00aa11bb22cc33"]), [
  "371162186579881984",
  "65f1c0ffee00aa11bb22cc33",
]);
assert.equal(plainIds(["1", "1/../../users/2/ban"]), null);
assert.equal(plainIds([""]), null);
assert.equal(plainIds([42]), null);
assert.equal(plainIds("1"), null);
assert.equal(plainIds([]), null);
assert.equal(plainIds(Array.from({ length: BULK_MAX + 1 }, (_, i) => String(i))), null);

// Queue rows travel in the request body, so a comment's "video:comment" id is fine; the type is not.
assert.deepEqual(queueTargets([{ targetType: "COMMENT", targetId: "1:2" }]), [
  { targetType: "COMMENT", targetId: "1:2" },
]);
assert.equal(queueTargets([{ targetType: "STORY", targetId: "1" }]), null);
assert.equal(queueTargets([{ targetType: "USER", targetId: "" }]), null);
assert.equal(queueTargets([]), null);

console.log("bulk checks passed");
