import "server-only";

import { USE_MOCK } from "./config";
import type { Page } from "./types";
import { MOCK_NOW } from "@/lib/mock/random";

/*
 * What every domain module in lib/api shares. Each one switches between mock and live on
 * USE_MOCK (see config.ts) with identical signatures either way, so pages never branch on it.
 */

/**
 * Rows per page in the directories and the moderation lists. Matches the `@PageableDefault`
 * the four endpoints declare, so an unparameterised request and a page-0 request agree.
 */
export const LIST_PAGE_SIZE = 25;

/**
 * A mock slice shaped like the Spring page the live path returns, so a page reads the same
 * fields either way and never branches on USE_MOCK.
 */
export function mockPage<T>(rows: T[], page: number, size: number): Page<T> {
  return {
    content: rows.slice(page * size, page * size + size),
    totalElements: rows.length,
    totalPages: Math.max(1, Math.ceil(rows.length / size)),
    number: page,
    size,
  };
}

/**
 * The clock every dated page measures against. Mock fixtures are generated from a
 * frozen instant, so bucketing them against the real now would land every row outside
 * the window and draw an empty chart.
 */
export function referenceNow(): number {
  return USE_MOCK ? MOCK_NOW : Date.now();
}
