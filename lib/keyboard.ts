/**
 * Whether a key press lands in something being typed into — an input, a textarea, a select or an
 * editable region — where a single-key shortcut ("/" for the search, J or A on the review screen)
 * has to stay a character.
 */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}
