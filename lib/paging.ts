import type { Page } from "@/lib/api/types";

export interface Collected<T> {
  rows: T[];
  /** What the listing reported as matching — more than `rows` when the cap cut it short. */
  total: number;
  truncated: boolean;
}

/**
 * Every page of a listing, one after another, until it runs out or `maxRows` is reached.
 *
 * One at a time with a pause between: the gateway's rate limit is per address, and every
 * server-side call this console makes comes from the same one, so an export that fetched its
 * pages side by side would spend the budget the pages being browsed meanwhile need.
 */
export async function collectPages<T>(
  load: (page: number) => Promise<Page<T>>,
  {
    maxRows,
    pauseMs = 0,
    sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
  }: { maxRows: number; pauseMs?: number; sleep?: (ms: number) => Promise<void> },
): Promise<Collected<T>> {
  const rows: T[] = [];
  for (let page = 0; ; page++) {
    if (page > 0 && pauseMs > 0) await sleep(pauseMs);
    const { content, totalElements, totalPages } = await load(page);
    rows.push(...content);
    if (rows.length >= maxRows) {
      return { rows: rows.slice(0, maxRows), total: totalElements, truncated: totalElements > maxRows };
    }
    if (content.length === 0 || page + 1 >= totalPages) {
      return { rows, total: totalElements, truncated: false };
    }
  }
}
