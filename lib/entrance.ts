/**
 * Whether a page's blocks rise in as they arrive: only the first time the page is shown in this
 * visit to the console. Coming back to it — from the sidebar, the back button, another filter, the
 * next page of a table — finds it already standing. A visit is one load of the console, so a reload
 * plays the page again.
 *
 * A page counts as shown once some of its blocks were inserted, not when its URL was: leaving a page
 * while its loading state is still up keeps its entrance for the next time.
 */
export function createEntranceLog() {
  const shown = new Set<string>();
  let url: string | undefined;
  let path = "";
  let plays = true;

  return {
    /**
     * The console is at this URL now. A URL other than last time's starts a new view, and the view
     * plays only if its path has not been shown: the query is a filter, not another page.
     */
    at(pathname: string, search: string) {
      if (pathname + search === url) return;
      url = pathname + search;
      path = pathname;
      plays = !shown.has(pathname);
    },

    /** Blocks of the current view were inserted: whether they play. The page now counts as shown. */
    arrive(): boolean {
      shown.add(path);
      return plays;
    },
  };
}

/** The beat between two blocks, as `--beat` steps in globals.css: change both together. */
export const BEAT_MS = 70;

/**
 * When the `order`-th of the blocks that scrolled into view together starts, counting from 0 in
 * document order. Capped like the page's own cascade, so a long jump down does not leave the last
 * block waiting.
 */
export function lateDelayMs(order: number): number {
  return Math.min(order, 5) * BEAT_MS;
}
