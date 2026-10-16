import type { ModerationTermAction, TextCategory } from "@/lib/api/types";

/** What admin-service caps, in code points as it counts them: a term, its note, a previewed text. */
export const TERM_MAX = 50;
export const NOTE_MAX = 500;
export const PREVIEW_MAX = 2000;

/**
 * What an admin term can be filed under: every category but CREATOR_FILTER, which means "the video
 * owner's own setting" and which admin-service refuses on a term.
 */
export const TERM_CATEGORIES: readonly TextCategory[] = [
  "PROFANITY",
  "INSULT",
  "HATE",
  "SEXUAL",
  "VIOLENCE",
  "SCAM",
  "SPAM",
  "PERSONAL_INFO",
];

const LETTER_OR_DIGIT = /[\p{L}\p{N}]/u;

function codePoints(text: string): number {
  return [...text].length;
}

/**
 * Why a term cannot be sent as it stands, or null — the checks admin-service makes on the form's
 * own fields, so a typo is answered before the round trip. Whether the shipped list has the term,
 * or already flags it as hard, only admin-service can say.
 */
export function termProblem(input: {
  term: string;
  action: ModerationTermAction;
  category: TextCategory | null;
  note: string;
}): string | null {
  // Spaces are counted as admin-service counts them, after its sanitizer has collapsed the runs.
  const term = input.term.trim().replace(/\s+/g, " ");
  if (!term) return "Write the term to match.";
  if (!LETTER_OR_DIGIT.test(term)) {
    return "A term needs a letter or a digit — punctuation and emoji alone match nothing.";
  }
  if (codePoints(term) > TERM_MAX) return `A term is at most ${TERM_MAX} characters.`;
  if (input.action !== "EXEMPT" && !(input.category && TERM_CATEGORIES.includes(input.category))) {
    return "Pick a category — it is what a match is filed under.";
  }
  if (codePoints(input.note.trim()) > NOTE_MAX) return `A note is at most ${NOTE_MAX} characters.`;
  return null;
}

/** Why a text cannot be previewed, or null. */
export function previewProblem(text: string): string | null {
  if (!text.trim()) return "Write a text to check.";
  if (codePoints(text) > PREVIEW_MAX) return `At most ${PREVIEW_MAX} characters can be checked at once.`;
  return null;
}

/**
 * A failed add or removal in the console's words. The two that are about the list as it stands get
 * a sentence of their own. An INVALID_MODERATION_TERM keeps admin-service's, which is the only thing
 * that knows what is wrong with this one: not on the shipped list, so nothing to exempt, or already
 * on it at least as hard.
 */
export function termErrorMessage(code: string | null, message: string): string {
  switch (code) {
    case "MODERATION_TERM_EXISTS":
      return "That term is already on the list, perhaps written another way: case, spacing and look-alike letters do not make a different term. To change what it does, remove it and add it again.";
    case "MODERATION_TERM_NOT_FOUND":
      return "That term was no longer on the list — someone removed it already.";
    case "INVALID_MODERATION_TERM":
      return `Not added: ${/[.!?]$/.test(message) ? message : `${message}.`}`;
    default:
      return message;
  }
}

/**
 * Whether a term matches every spelling of itself. One written without diacritics is matched
 * against text with its diacritics removed, so "nha cai" catches "nhà cái" and "nha cái" alike;
 * one written with them matches only those — and they are different terms, to exempt one by one.
 */
export function matchesAnyDiacritics(term: string): boolean {
  const decomposed = term.toLowerCase().normalize("NFD");
  return decomposed.replace(/\p{M}/gu, "").replace(/đ/g, "d") === decomposed;
}

/** What a flag does on its own, as a word: severity 3 refuses, 2 holds, 1 is a note. */
export function flagWeight(severity: number): "refuses" | "holds" | "note" {
  if (severity >= 3) return "refuses";
  return severity === 2 ? "holds" : "note";
}
