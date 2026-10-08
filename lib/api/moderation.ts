import "server-only";

import { apiGet } from "./client";
import { USE_MOCK } from "./config";
import { LIST_PAGE_SIZE, mockPage } from "./shared";
import type {
  ModerationActionResponse,
  ModerationActionType,
  ModerationSettingsResponse,
  Page,
  ReportTargetType,
} from "./types";
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
} = {}): Promise<Page<ModerationActionResponse>> {
  const { page = 0, size = LIST_PAGE_SIZE, adminId, actionType, from, to } = options;
  if (USE_MOCK) {
    const matches = mockModerationActions.filter(
      (a) =>
        (!adminId || a.adminId === adminId)
        && (!actionType || a.actionType === actionType)
        && (!from || Date.parse(a.createdAt) >= Date.parse(from))
        && (!to || Date.parse(a.createdAt) < Date.parse(to)),
    );
    return mockPage(matches, page, size);
  }

  const params = new URLSearchParams({
    page: String(page),
    size: String(size),
    sort: "createdAt,desc",
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
      },
    };
  }
  return apiGet<ModerationSettingsResponse>("/api/v1/admin/settings/moderation");
}
