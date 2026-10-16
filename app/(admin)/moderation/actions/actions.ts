"use server";

import { getTargetPreview, type TargetPreview } from "@/lib/api/previews";
import type { ReportTargetType } from "@/lib/api/types";

export interface ActionRowDetail {
  /** What it was done to, same shape the reports queue already resolves. */
  preview: TargetPreview | null;
}

/**
 * What an expanded audit row shows beyond the log entry itself: what the target actually is (a
 * video title, a @handle, a comment body) instead of a bare id. Fetched on expand, not per page —
 * a log of 100 rows would otherwise be 100 calls on first paint. The admin is not looked up here:
 * the page names every admin on it in one go.
 */
export async function actionRowDetailAction(
  targetType: ReportTargetType,
  targetId: string,
): Promise<ActionRowDetail> {
  return { preview: await getTargetPreview(targetType, targetId).catch(() => null) };
}
