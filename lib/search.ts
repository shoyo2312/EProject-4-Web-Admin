/**
 * A whole id, as pasted from a URL or a log line — worth looking up directly on top of the text
 * search. Users, videos and reports all carry Snowflake longs written out as digits. The short
 * tails the tables print ("#…4821") are not ids, and a lookup by one could only miss.
 */
export function looksLikeId(query: string): boolean {
  return /^\d{10,20}$/.test(query.trim());
}

export interface PageEntry {
  label: string;
  section: string;
  href: string;
}

/**
 * The console's own pages matching what was typed: names starting with it first, then names or
 * sections containing it. Every page, in nav order, while nothing is typed — the palette doubles
 * as a way to jump around.
 */
export function matchPages<T extends PageEntry>(query: string, pages: readonly T[]): T[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [...pages];
  const starting: T[] = [];
  const containing: T[] = [];
  for (const page of pages) {
    const label = page.label.toLowerCase();
    if (label.startsWith(needle)) starting.push(page);
    else if (label.includes(needle) || page.section.toLowerCase().includes(needle)) {
      containing.push(page);
    }
  }
  return [...starting, ...containing];
}

/**
 * The highlighted option after an arrow key, wrapping at both ends. From no highlight, down lands
 * on the first option and up on the last; -1 when there is nothing to highlight.
 */
export function moveSelection(index: number, delta: number, length: number): number {
  if (length === 0) return -1;
  if (index < 0) return delta > 0 ? 0 : length - 1;
  return (((index + delta) % length) + length) % length;
}
