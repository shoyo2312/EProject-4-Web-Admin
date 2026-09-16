"use server";

import { getUserProfiles } from "@/lib/api/admin";
import { loadPreview, type TargetPreview } from "@/app/(admin)/moderation/reports/actions";
import type { ReportTargetType, UserProfileResponse } from "@/lib/api/types";

export interface ActionRowDetail {
  /** Who did it — @handle when user-service has one, null to fall back to the id tail. */
  adminHandle: string | null;
  /** What it was done to, same shape the reports queue already resolves. */
  preview: TargetPreview | null;
}

/**
 * Everything an expanded audit row shows beyond the log entry itself: the admin's handle and what
 * the target actually is (a video title, a @handle, a comment body) instead of a bare id. Fetched
 * on expand, not per page — a log of 100 rows would otherwise be 200 calls on first paint.
 */
export async function actionRowDetailAction(
  adminId: string,
  targetType: ReportTargetType,
  targetId: string,
): Promise<ActionRowDetail> {
  const [profiles, preview] = await Promise.all([
    getUserProfiles([adminId]).catch(
      (): Record<string, UserProfileResponse> => ({}),
    ),
    loadPreview(targetType, targetId).catch(() => null),
  ]);
  const admin = profiles[adminId];
  return {
    adminHandle: admin?.username ? `@${admin.username}` : null,
    preview,
  };
}
