import "server-only";

import { EXPORT_MAX_ROWS, type CsvRow, type ExportDataset } from "@/lib/csv";
import {
  auditFilters,
  reportFilters,
  userFilters,
  videoFilters,
  type ListParams,
} from "@/lib/list-filters";
import { collectPages, type Collected } from "@/lib/paging";
import { listModerationActions } from "./moderation";
import { listReports } from "./reports";
import { referenceNow } from "./shared";
import { listUsers, resolveOwners } from "./users";
import { listVideos } from "./videos";
import type { Page } from "./types";
import { isoDay, resolveWindow, windowRange } from "./window";

const PAGE_SIZE = 50;
/** About ten pages a second — half the gateway's per-address rate, leaving the rest to browsing. */
const PAUSE_MS = 100;

/**
 * Every row a listing page's filters match, read the way that page reads them — the same
 * parsing, and the same joined-by date cut where the page applies one — so the file is the page
 * with the paging taken away.
 */
export async function exportRows(
  dataset: ExportDataset,
  params: ListParams,
): Promise<Collected<CsvRow>> {
  const window = resolveWindow(params, isoDay(referenceNow()));
  const collect = <T>(load: (page: number) => Promise<Page<T>>) =>
    collectPages(load, { maxRows: EXPORT_MAX_ROWS, pauseMs: PAUSE_MS });

  switch (dataset) {
    case "users": {
      const { q, status } = userFilters(params);
      const all = await collect((page) => listUsers({ q, status, page, size: PAGE_SIZE }));
      return { ...all, rows: all.rows.filter((u) => u.createdAt.slice(0, 10) <= window.asOf) };
    }
    case "videos": {
      const { q, ownerId, status, deletedOnly } = videoFilters(params);
      const ownerIds = ownerId ? [ownerId] : q ? await resolveOwners(q) : [];
      const all = await collect((page) =>
        listVideos({
          q,
          ownerIds,
          status,
          deleted: deletedOnly ? true : undefined,
          page,
          size: PAGE_SIZE,
        }),
      );
      return { ...all, rows: all.rows.filter((v) => v.createdAt.slice(0, 10) <= window.asOf) };
    }
    case "reports": {
      const filters = reportFilters(params);
      return collect((page) => listReports({ ...filters, page, size: PAGE_SIZE }));
    }
    case "moderation-actions": {
      const filters = { ...auditFilters(params), ...windowRange(window) };
      return collect((page) => listModerationActions({ ...filters, page, size: PAGE_SIZE }));
    }
  }
}
