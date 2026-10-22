"use server";

import { revalidatePath } from "next/cache";
import { getModerationDetail, type ModerationDetail } from "@/lib/api/moderation";
import { getTargetPreview, type TargetPreview } from "@/lib/api/previews";
import { resolveQueueRow, resolveReport } from "@/lib/api/reports";
import type { ModerationActionType, ReportTargetType } from "@/lib/api/types";
import { bulkSummary, cleanReason, queueTargets, runEach, type QueueTarget } from "@/lib/bulk";
import type { ModerationResult } from "@/lib/moderation";

export interface ReportTargetDetail extends ModerationDetail {
  preview: TargetPreview | null;
}

/**
 * Everything an expanded report row shows beyond the report itself: what is being judged, how many
 * other reports stand against the same target, and what has already been done about it. Fetched on
 * expand rather than per page — a queue of 100 rows would otherwise be 300 calls on first paint.
 */
export async function reportTargetDetailAction(
  targetType: ReportTargetType,
  targetId: string,
): Promise<ReportTargetDetail> {
  const [detail, preview] = await Promise.all([
    getModerationDetail(targetType, targetId),
    // A preview is a convenience; the report and its history are the point, so a target that
    // cannot be read does not fail the whole row.
    getTargetPreview(targetType, targetId).catch(() => null),
  ]);
  return { ...detail, preview };
}

/**
 * Close one queue row: the decision about the target, and with it every report standing against
 * it. The per-report path below is the report ledger's; this is the queue's, because a queue row
 * is a target and an admin looking at it is making one decision about that target.
 *
 * Same caveat as {@link resolveReportAction}: the enforcement lands when the owning service
 * consumes the event, not by the time this returns.
 */
export async function resolveQueueAction(
  targetType: ReportTargetType,
  targetId: string,
  actionType: ModerationActionType,
  reason: string,
  /** Days until a BAN_USER lapses; null is permanent. Ignored for every other action. */
  banDays: number | null = null,
): Promise<ModerationResult> {
  if (!reason.trim()) {
    return { ok: false, message: "A reason is required — it goes into the audit log." };
  }

  try {
    await resolveQueueRow(targetType, targetId, actionType, reason.trim(), banDays);
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }

  revalidatePath("/moderation/reports");
  revalidatePath("/moderation/actions");
  return {
    ok: true,
    message:
      actionType === "DISMISS_REPORT"
        ? "Dismissed. Nothing happens to the target; every report against it is closed and the decision is in the audit log."
        : "Resolved. Every report against this target is closed now, and the action is applied once the owning service consumes the event.",
  };
}

/**
 * Close one report. The enforcement is not applied by the time this returns: admin-service records
 * the decision, writes an outbox row and publishes it, and the owning service (video, auth,
 * interaction) acts when it consumes admin.moderation-events. The report's own status flips
 * immediately — that part is admin-service's own table.
 */
export async function resolveReportAction(
  reportId: string,
  actionType: ModerationActionType,
  reason: string,
  /** Days until a BAN_USER lapses; null is permanent. Ignored for every other action. */
  banDays: number | null = null,
): Promise<ModerationResult> {
  if (!reason.trim()) {
    return { ok: false, message: "A reason is required — it goes into the audit log." };
  }

  try {
    await resolveReport(reportId, actionType, reason.trim(), banDays);
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }

  revalidatePath("/moderation/reports");
  revalidatePath("/moderation/actions");
  return {
    ok: true,
    message:
      actionType === "DISMISS_REPORT"
        ? "Report dismissed. Nothing happens to the target; the decision is in the audit log."
        : "Report resolved. The action is recorded now and applied once the owning service consumes the event.",
  };
}

/**
 * Dismiss every ticked queue row: nothing happens to the targets, every report against each is
 * closed, and each dismissal is its own audit entry. Enforcement stays one row at a time — the
 * action differs per target, and a ban is not something to apply to a list.
 */
export async function bulkDismissQueueAction(
  targets: QueueTarget[],
  reason: string,
): Promise<ModerationResult> {
  const rows = queueTargets(targets);
  if (!rows) return { ok: false, message: "Nothing valid was selected." };
  const why = cleanReason(reason);
  if (!why) {
    return { ok: false, message: "Give a reason of at most 1,000 characters — it goes into the audit log." };
  }

  const outcome = await runEach(
    rows,
    (row) => resolveQueueRow(row.targetType, row.targetId, "DISMISS_REPORT", why),
    // The table's own row key, so the rows that failed can stay ticked.
    (row) => `${row.targetType}:${row.targetId}`,
  );

  revalidatePath("/moderation/reports");
  revalidatePath("/moderation/actions");
  return {
    ok: outcome.failed.length === 0,
    message: bulkSummary(outcome, "Dismissed the reports on", "target"),
    failedIds: outcome.failed.map((failure) => failure.id),
  };
}
