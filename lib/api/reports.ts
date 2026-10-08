import "server-only";

import { ApiError, apiGet, apiPost } from "./client";
import { USE_MOCK } from "./config";
import { LIST_PAGE_SIZE, mockPage } from "./shared";
import type {
  ModerationActionResponse,
  ModerationActionType,
  Page,
  ReportGroupResponse,
  ReportResponse,
  ReportStatus,
  ReportTargetType,
} from "./types";
import type { ReportSortField } from "@/lib/list-filters";
import { mockReportQueue, mockReports } from "@/lib/mock/moderation";

/**
 * Applies a `field,dir` ordering to the mock fixtures, so a page reads the same either way.
 * Ids are numeric strings of differing length and compare as numbers — `localeCompare` would
 * put "9" after "10".
 */
function sortReports(
  rows: ReportResponse[],
  field: ReportSortField,
  ascending: boolean,
): ReportResponse[] {
  const sign = ascending ? 1 : -1;
  return [...rows].sort((a, b) =>
    field === "id"
      ? (Number(a.id) - Number(b.id)) * sign
      : a[field].localeCompare(b[field]) * sign,
  );
}

/**
 * The report ledger: every report ever filed, narrowed and ordered by the server.
 *
 * Every control goes to the backend rather than being applied to the rows that come back. The
 * listing is paged, so a status filter applied here would mean "the dismissed ones among these
 * twenty-five" while reading as a platform total — and a sort applied here can only reorder the
 * rows that already won. The same goes for `targetId` and `reporterId`, the two halves an
 * account's activity history needs — what was filed against it, and what it filed against
 * others: narrowing a fetched page would show whichever of the account's reports landed on page 0
 * and call it the whole history.
 */
export async function listReports(options: {
  status?: ReportStatus;
  targetType?: ReportTargetType;
  targetId?: string;
  reporterId?: string;
  sort?: ReportSortField;
  ascending?: boolean;
  page?: number;
  size?: number;
} = {}): Promise<Page<ReportResponse>> {
  const {
    status,
    targetType,
    targetId,
    reporterId,
    sort = "createdAt",
    ascending = false,
    page = 0,
    size = LIST_PAGE_SIZE,
  } = options;

  if (USE_MOCK) {
    const filtered = mockReports.filter(
      (report) =>
        (!status || report.status === status)
        && (!targetType || report.targetType === targetType)
        && (!targetId || report.targetId === targetId)
        && (!reporterId || report.reporterId === reporterId),
    );
    return mockPage(sortReports(filtered, sort, ascending), page, size);
  }

  const params = new URLSearchParams({
    page: String(page),
    size: String(size),
    sort: `${sort},${ascending ? "asc" : "desc"}`,
  });
  if (status) params.set("status", status);
  if (targetType) params.set("targetType", targetType);
  if (targetId) params.set("targetId", targetId);
  if (reporterId) params.set("reporterId", reporterId);

  return apiGet<Page<ReportResponse>>(`/api/v1/admin/reports?${params}`);
}

/**
 * The worklist: one row per reported target, heaviest first. Separate endpoint from
 * {@link listReports}, which is the report ledger — fifty people flagging one video is fifty
 * rows there and one row here, and one row here is one decision.
 *
 * No sort parameter: the ordering (`reportCount × severity`, longest wait breaking ties) is the
 * queue's reason for existing and is computed across the whole table, not the page. A client-side
 * sort could only reorder the twenty-five rows that already won.
 */
export async function listReportQueue(options: {
  page?: number;
  size?: number;
} = {}): Promise<Page<ReportGroupResponse>> {
  const { page = 0, size = LIST_PAGE_SIZE } = options;
  if (USE_MOCK) return mockPage(mockReportQueue, page, size);

  const params = new URLSearchParams({ page: String(page), size: String(size) });
  return apiGet<Page<ReportGroupResponse>>(`/api/v1/admin/reports/queue?${params}`);
}

/**
 * Decides one queue row: writes the audit action, publishes the enforcement event, and closes
 * every report standing against that target in the same transaction.
 *
 * Addressed by target rather than by report id — naming one of forty reports to carry the
 * decision would put an arbitrary row in the audit log as though it were the reason.
 */
export async function resolveQueueRow(
  targetType: ReportTargetType,
  targetId: string,
  actionType: ModerationActionType,
  reason: string,
  /** Days until a BAN_USER lapses, or null for one that does not. Ignored for other actions. */
  banDays: number | null = null,
): Promise<ModerationActionResponse> {
  if (USE_MOCK) {
    throw new Error("Resolving a report requires the live backend (ADMIN_USE_MOCK=false).");
  }
  return apiPost<ModerationActionResponse>("/api/v1/admin/reports/queue/resolve", {
    targetType,
    targetId,
    actionType,
    reason,
    banDays,
  });
}

export async function resolveReport(
  reportId: string,
  actionType: ModerationActionType,
  reason: string,
  /** Days until a BAN_USER lapses, or null for one that does not. Ignored for other actions. */
  banDays: number | null = null,
): Promise<ReportResponse> {
  if (USE_MOCK) {
    throw new Error("Resolving a report requires the live backend (ADMIN_USE_MOCK=false).");
  }
  return apiPost<ReportResponse>(`/api/v1/admin/reports/${reportId}/resolve`, {
    actionType,
    reason,
    banDays,
  });
}

/**
 * One report by id — what a moderator pastes when someone asks about report #…4821. Null for an
 * id nothing was filed under (404) and for one that is not a number at all (400): a mistyped id
 * is "not found", not a failure.
 */
export async function getReport(reportId: string): Promise<ReportResponse | null> {
  if (USE_MOCK) return mockReports.find((report) => report.id === reportId) ?? null;
  try {
    return await apiGet<ReportResponse>(`/api/v1/admin/reports/${encodeURIComponent(reportId)}`);
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) return null;
    throw error;
  }
}

/** How many reports have been filed against one user, video or comment. */
export async function getReportCount(
  targetType: ReportTargetType,
  targetId: string,
): Promise<number> {
  if (USE_MOCK) {
    return mockReports.filter(
      (r) => r.targetType === targetType && r.targetId === targetId,
    ).length;
  }
  const params = new URLSearchParams({ targetType, targetId });
  return apiGet<number>(`/api/v1/admin/reports/count?${params}`);
}
