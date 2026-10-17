// Run: node lib/__tests__/account-closure.test.mjs
import assert from "node:assert/strict";
import { registerHooks } from "node:module";

// account-closure.ts formats its dates through lib/format, by the "@/" alias only the bundler
// knows. Resolved here the way tsconfig maps it, before the module is loaded.
registerHooks({
  resolve: (specifier, context, next) =>
    next(
      specifier.startsWith("@/") ? new URL(`../../${specifier.slice(2)}.ts`, import.meta.url).href : specifier,
      context,
    ),
});

const { closureNote } = await import("../account-closure.ts");

const CLOSED = "2026-10-17T08:00:00Z";
const DELETION = "2026-11-16T08:00:00Z";

// An account its owner never closed says nothing — banned or not.
assert.equal(closureNote({ status: "ACTIVE", deactivatedAt: null, deletionScheduledAt: null }), null);
assert.equal(closureNote({ status: "BANNED", deactivatedAt: null, deletionScheduledAt: null }), null);

// Paused only: signing in reopens it.
assert.equal(
  closureNote({ status: "DEACTIVATED", deactivatedAt: CLOSED, deletionScheduledAt: null }),
  "Closed by its owner on 17/10/2026, 15:00:00. It reopens if they sign in again.",
);

// A deletion is pending: the date, and what calls it off.
assert.equal(
  closureNote({ status: "DEACTIVATED", deactivatedAt: CLOSED, deletionScheduledAt: DELETION }),
  "Closed by its owner on 17/10/2026, 15:00:00; deleted for good on 16/11/2026, 15:00:00 unless they sign in before then.",
);

// Banned on top: the ban neither stops the deletion nor, lifted, reopens the account.
assert.match(
  closureNote({ status: "BANNED", deactivatedAt: CLOSED, deletionScheduledAt: DELETION }),
  /deleted for good on 16\/11\/2026, 15:00:00\. The ban does not stop the deletion/,
);
assert.match(
  closureNote({ status: "BANNED", deactivatedAt: CLOSED, deletionScheduledAt: null }),
  /Lifting the ban leaves it closed\.$/,
);

console.log("account-closure checks passed");
