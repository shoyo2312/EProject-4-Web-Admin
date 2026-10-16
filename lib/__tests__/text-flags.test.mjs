// Run: node lib/__tests__/text-flags.test.mjs
import assert from "node:assert/strict";
import { registerHooks } from "node:module";

// text-flags.ts names categories through lib/labels, by the "@/" alias only the bundler knows.
// Resolved here the way tsconfig maps it, before the module is loaded.
registerHooks({
  resolve: (specifier, context, next) =>
    next(
      specifier.startsWith("@/") ? new URL(`../../${specifier.slice(2)}.ts`, import.meta.url).href : specifier,
      context,
    ),
});
const { flagText, parseTextFlag, reasonFlags } = await import("../text-flags.ts");

// A comment's flag: the category, then what fired — which can hold colons of its own.
assert.deepEqual(parseTextFlag("SPAM:link:bit.ly"), { field: null, category: "SPAM", rule: "link:bit.ly" });
assert.deepEqual(parseTextFlag("HATE:model:HATE:0.93"), {
  field: null,
  category: "HATE",
  rule: "model:HATE:0.93",
});
assert.deepEqual(parseTextFlag("CREATOR_FILTER:term:nhà cái"), {
  field: null,
  category: "CREATOR_FILTER",
  rule: "term:nhà cái",
});
// A caption's leads with the field it was found in.
assert.deepEqual(parseTextFlag("DESCRIPTION:SPAM:link:bit.ly"), {
  field: "DESCRIPTION",
  category: "SPAM",
  rule: "link:bit.ly",
});
assert.deepEqual(parseTextFlag("TAGS:SCAM:betting:fb88"), { field: "TAGS", category: "SCAM", rule: "betting:fb88" });

// A comment keeps every flag on one line, most severe first.
assert.deepEqual(
  reasonFlags("SPAM:link:bit.ly; HATE:model:HATE:0.82").map((flag) => flag.category),
  ["SPAM", "HATE"],
);
assert.deepEqual(reasonFlags(null), []);
assert.deepEqual(reasonFlags(""), []);

// On screen: the field and the category by name, then the rule as the service wrote it.
assert.equal(flagText(parseTextFlag("DESCRIPTION:PERSONAL_INFO:phone")), "Description · Personal info: phone");
assert.equal(flagText(parseTextFlag("SPAM:link:bit.ly")), "Spam: link:bit.ly");
assert.equal(flagText(parseTextFlag("SPAM")), "Spam", "no rule, no dangling colon");
// A category this console does not know yet reads as its own name, not "undefined".
assert.equal(flagText(parseTextFlag("WEAPONS:term:x")), "WEAPONS: term:x");

console.log("text-flags checks passed");
