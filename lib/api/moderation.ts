import "server-only";

import { apiGet } from "./client";
import { USE_MOCK } from "./config";
import { getAdminHandles } from "./names";
import { getReportCount } from "./reports";
import { LIST_PAGE_SIZE, mockPage } from "./shared";
import type {
  ModerationActionResponse,
  ModerationActionType,
  ModerationSettingsResponse,
  Page,
  ReportTargetType,
} from "./types";
import type { ActionSortField } from "@/lib/list-filters";
import { mockModerationActions } from "@/lib/mock/moderation";

/** The audit log, newest first. Every filter is optional; `from` is inclusive, `to` exclusive. */
export async function listModerationActions(options: {
  page?: number;
  size?: number;
  adminId?: string;
  actionType?: ModerationActionType;
  /** ISO instants. */
  from?: string;
  to?: string;
  /**
   * Ordered by admin-service, which breaks ties newest first, so a page boundary never splits or
   * repeats the rows that share a type.
   */
  sort?: ActionSortField;
  ascending?: boolean;
} = {}): Promise<Page<ModerationActionResponse>> {
  const {
    page = 0,
    size = LIST_PAGE_SIZE,
    adminId,
    actionType,
    from,
    to,
    sort = "createdAt",
    ascending = false,
  } = options;
  if (USE_MOCK) {
    const matches = mockModerationActions.filter(
      (a) =>
        (!adminId || a.adminId === adminId)
        && (!actionType || a.actionType === actionType)
        && (!from || Date.parse(a.createdAt) >= Date.parse(from))
        && (!to || Date.parse(a.createdAt) < Date.parse(to)),
    );
    const sign = ascending ? 1 : -1;
    const ordered = [...matches].sort(
      (a, b) =>
        a[sort].localeCompare(b[sort]) * sign
        || (sort === "createdAt" ? 0 : b.createdAt.localeCompare(a.createdAt)),
    );
    return mockPage(ordered, page, size);
  }

  const params = new URLSearchParams({
    page: String(page),
    size: String(size),
    sort: `${sort},${ascending ? "asc" : "desc"}`,
  });
  if (adminId) params.set("adminId", adminId);
  if (actionType) params.set("actionType", actionType);
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  return apiGet<Page<ModerationActionResponse>>(`/api/v1/admin/actions?${params}`);
}

/**
 * One target's moderation history — every takedown/restore/ban/unban recorded against it, newest
 * first. Same endpoint as {@link listModerationActions}, narrowed by target. The console loads it
 * lazily when a row is expanded, so the default page is small.
 */
export async function listTargetActions(
  targetType: ReportTargetType,
  targetId: string,
  size = 20,
): Promise<ModerationActionResponse[]> {
  if (USE_MOCK) {
    return mockModerationActions
      .filter((a) => a.targetType === targetType && a.targetId === targetId)
      .slice(0, size);
  }
  const params = new URLSearchParams({
    targetType,
    targetId,
    size: String(size),
    sort: "createdAt,desc",
  });
  const page = await apiGet<Page<ModerationActionResponse>>(`/api/v1/admin/actions?${params}`);
  return page.content;
}

export interface ModerationDetail {
  reportCount: number;
  actions: ModerationActionResponse[];
  /** adminId → @handle, for the admins named in `actions`. */
  handles: Record<string, string>;
}

/**
 * The report count and the moderation history of one target, with the admins in it named —
 * what an expanded row of the users, videos and report tables shows. Read when a row is opened
 * rather than for the page: a page of a hundred rows would otherwise be two hundred calls on first
 * paint.
 */
export async function getModerationDetail(
  targetType: ReportTargetType,
  targetId: string,
): Promise<ModerationDetail> {
  const [reportCount, actions] = await Promise.all([
    getReportCount(targetType, targetId),
    listTargetActions(targetType, targetId),
  ]);
  return { reportCount, actions, handles: await getAdminHandles(actions.map((a) => a.adminId)) };
}

/**
 * How many times this target has been banned, taken down or had a comment removed.
 *
 * Counts enforcement only, and a reversal does not subtract — see admin-service's
 * `countStrikes`. Zero is a clean record; it is not "no data".
 */
export async function getStrikeCount(
  targetType: ReportTargetType,
  targetId: string,
): Promise<number> {
  if (USE_MOCK) return 0;
  const params = new URLSearchParams({ targetType, targetId });
  return apiGet<number>(`/api/v1/admin/actions/strikes?${params}`);
}

/**
 * What automatic moderation is deciding with. admin-service reads it from moderation-service,
 * which is internal-only, and answers `reachable: false` rather than failing if it cannot.
 */
export async function getModerationSettings(): Promise<ModerationSettingsResponse> {
  if (USE_MOCK) {
    return {
      reachable: true,
      values: {
        model: "Falconsai/nsfw_image_detection",
        modelVersion: "nsfw-v1",
        nsfwLabel: "nsfw",
        maxFrames: 32,
        reviewAt: 0.6,
        rejectAt: 0.9,
        minRejectFrames: 2,
        escalationEnabled: false,
        escalationFrames: 3,
        escalationCategories: ["Sexual", "Violence", "SelfHarm", "Hate"],
        escalationRejectSeverity: 4,
        escalationApproveSeverity: 0,
        textEnabled: true,
        textModel: "visolex/phobert-v2-hsd",
        textModelRevision: "221aca47de6568d519eba61a94d7fdae3ca680ae",
        textModelVersion: "hsd-v1",
        textHateHoldAt: 0.9,
        textMaxTexts: 16,
      },
    };
  }
  return apiGet<ModerationSettingsResponse>("/api/v1/admin/settings/moderation");
}
