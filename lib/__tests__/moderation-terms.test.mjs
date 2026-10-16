// Run: node lib/__tests__/moderation-terms.test.mjs
import assert from "node:assert/strict";
import {
  NOTE_MAX,
  PREVIEW_MAX,
  TERM_CATEGORIES,
  TERM_MAX,
  flagWeight,
  matchesAnyDiacritics,
  previewProblem,
  termErrorMessage,
  termProblem,
} from "../moderation-terms.ts";

// A term the form can send: a HOLD or a REJECT with a category, an EXEMPT without one.
const term = (fields) => ({ term: "kèo thơm", action: "HOLD", category: "SCAM", note: "", ...fields });
assert.equal(termProblem(term()), null);
assert.equal(termProblem(term({ action: "EXEMPT", category: null })), null);
assert.equal(termProblem(term({ action: "REJECT" })), null);

// What admin-service would refuse on the fields alone, answered before the round trip.
assert.match(termProblem(term({ term: "   " })), /^Write the term/);
assert.match(termProblem(term({ term: "!!! 🙂" })), /letter or a digit/);
assert.match(termProblem(term({ category: null })), /^Pick a category/);
assert.match(termProblem(term({ action: "REJECT", category: null })), /^Pick a category/);
// CREATOR_FILTER means the video owner's own setting; admin-service refuses it on a term.
assert.match(termProblem(term({ category: "CREATOR_FILTER" })), /^Pick a category/);
assert.ok(!TERM_CATEGORIES.includes("CREATOR_FILTER"));

// Counted in code points, as admin-service counts them, and after its sanitizer collapses spaces.
assert.equal(termProblem(term({ term: "đ".repeat(TERM_MAX) })), null, "one code point per letter");
assert.match(termProblem(term({ term: "đ".repeat(TERM_MAX + 1) })), /at most 50/);
assert.equal(termProblem(term({ term: `nhà${" ".repeat(60)}cái` })), null, "a run of spaces is one");
assert.equal(termProblem(term({ note: "x".repeat(NOTE_MAX) })), null);
assert.match(termProblem(term({ note: "x".repeat(NOTE_MAX + 1) })), /note is at most 500/);

assert.match(previewProblem(" \n "), /^Write a text/);
assert.equal(previewProblem("bọn này cút về quê"), null);
assert.match(previewProblem("a".repeat(PREVIEW_MAX + 1)), /^At most 2000/);

// The two codes about the list as it stands read as sentences of their own; anything else keeps
// admin-service's message, which is the one that knows what is wrong with this term.
assert.match(termErrorMessage("MODERATION_TERM_EXISTS", "A term matching 'x' is already on the list"), /already on the list, perhaps written another way/);
assert.match(termErrorMessage("MODERATION_TERM_NOT_FOUND", "Moderation term not found: 7"), /someone removed it already/);
assert.equal(
  termErrorMessage(
    "INVALID_MODERATION_TERM",
    "'nha cai' is not on the shipped list 2026.10.15, so there is nothing to exempt. A term written with diacritics and its plain spelling are different terms",
  ),
  "Not added: 'nha cai' is not on the shipped list 2026.10.15, so there is nothing to exempt. A term written with diacritics and its plain spelling are different terms.",
);
assert.equal(termErrorMessage("INVALID_MODERATION_TERM", "Already on it."), "Not added: Already on it.", "no second full stop");
assert.equal(termErrorMessage("INTERNAL_ERROR", "An unexpected error occurred"), "An unexpected error occurred");
assert.equal(termErrorMessage(null, "fetch failed"), "fetch failed");

// Written without diacritics, a term catches every spelling; with them, only its own. đ counts.
assert.equal(matchesAnyDiacritics("nha cai"), true);
assert.equal(matchesAnyDiacritics("dm"), true);
assert.equal(matchesAnyDiacritics("Casino"), true, "case is not a diacritic");
assert.equal(matchesAnyDiacritics("nhà cái"), false);
assert.equal(matchesAnyDiacritics("NHÀ CÁI"), false);
assert.equal(matchesAnyDiacritics("đụ"), false);
assert.equal(matchesAnyDiacritics("địt"), false);
assert.equal(matchesAnyDiacritics("đ"), false, "đ alone, which has no combining mark to strip");

assert.equal(flagWeight(3), "refuses");
assert.equal(flagWeight(2), "holds");
assert.equal(flagWeight(1), "note");

console.log("moderation-terms checks passed");
