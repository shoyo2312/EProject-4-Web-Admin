// Run: node lib/__tests__/system-status.test.mjs
import assert from "node:assert/strict";
import { registerHooks } from "node:module";

registerHooks({
  resolve: (specifier, context, next) =>
    next(
      specifier.startsWith("@/") ? new URL(`../../${specifier.slice(2)}.ts`, import.meta.url).href : specifier,
      context,
    ),
});
const {
  classifierEnforcement,
  formatWait,
  listsDiffer,
  outboxHealth,
  outboxState,
  rulesEnforcement,
  textModerationHealth,
} = await import("../system-status.ts");

// Seconds stay seconds under a minute; nothing waiting is a dash, not "0s".
assert.equal(formatWait(0), "—");
assert.equal(formatWait(1.4), "1s");
assert.equal(formatWait(48), "48s");
assert.equal(formatWait(912), "16m");
assert.equal(formatWait(null), "unknown");

// The age decides, not the count: a long queue that moves is fine, one old row is not.
assert.equal(outboxState({ pending: 0, oldestPendingAgeSeconds: 0 }).label, "Empty");
assert.equal(outboxState({ pending: 900, oldestPendingAgeSeconds: 4 }).label, "Draining");
assert.deepEqual(outboxState({ pending: 1, oldestPendingAgeSeconds: 301 }), { tone: "bad", label: "Stuck" });
assert.equal(outboxState({ pending: 1, oldestPendingAgeSeconds: 300 }).label, "Draining");
assert.equal(outboxState({ pending: null, oldestPendingAgeSeconds: null }).tone, "warn");

const service = (name, reachable, outboxes) => ({ service: name, reachable, outboxes });
const outbox = (pending, age) => ({ name: "outbox_events", pending, oldestPendingAgeSeconds: age });

assert.deepEqual(outboxHealth([service("auth-service", true, [outbox(0, 0)])]), {
  tone: "ok",
  text: "Every outbox is draining.",
});
// Stuck outranks anything unreadable: it is the one an alert has already gone out for.
assert.equal(
  outboxHealth([service("video-service", true, [outbox(3, 900), outbox(1, 600)]), service("story-service", false, [])]).text,
  "2 outboxes stuck — the oldest event has waited over 5 minutes for Kafka.",
);
assert.deepEqual(
  outboxHealth([service("story-service", false, []), service("user-service", true, [outbox(null, null)])]),
  { tone: "warn", text: "1 service did not answer; 1 outbox could not be counted." },
);

const status = (overrides) => ({
  service: "video-service",
  reachable: true,
  enforce: true,
  version: "rules-1+admin-1",
  classifierEnabled: true,
  classifierEnforce: true,
  ...overrides,
});

// A null is a build that does not report it, not "off".
assert.equal(rulesEnforcement(status({ enforce: null })).label, "Not reported");
assert.equal(rulesEnforcement(status({ enforce: false })).label, "Recording only");
assert.equal(rulesEnforcement(status({ reachable: false })).label, "Did not answer");
// A classifier without an address is off, whatever its enforce flag says.
assert.equal(classifierEnforcement(status({ classifierEnabled: false, classifierEnforce: true })).label, "Off");
assert.equal(classifierEnforcement(status({ classifierEnforce: false })).label, "Recording only");

assert.deepEqual(textModerationHealth([status({})]), { tone: "ok", text: "Every service acts on what it finds." });
assert.equal(
  textModerationHealth([status({ service: "interaction-service", classifierEnforce: false }), status({})]).text,
  "interaction-service records verdicts without acting on all of them.",
);
// A switched-off classifier is not "recording only": it is not asked at all.
assert.equal(textModerationHealth([status({ classifierEnabled: false, classifierEnforce: false })]).tone, "ok");
assert.equal(
  textModerationHealth([status({ service: "story-service", reachable: false, enforce: null })]).text,
  "No report from story-service.",
);

assert.equal(listsDiffer([{ version: "rules-1+admin-14" }, { version: "rules-1+admin-14" }, { version: null }]), false);
assert.equal(listsDiffer([{ version: "rules-1+admin-14" }, { version: "rules-1+admin-13" }]), true);
