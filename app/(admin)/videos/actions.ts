"use server";

import { revalidatePath } from "next/cache";
import { getModerationDetail, type ModerationDetail } from "@/lib/api/moderation";
import { moderateVideo } from "@/lib/api/videos";
import { bulkSummary, cleanReason, plainIds, runEach } from "@/lib/bulk";
import type { ModerationResult } from "@/lib/moderation";

/** One video's report count and moderation history, for its row in the videos table. */
export async function videoModerationDetailAction(videoId: string): Promise<ModerationDetail> {
  return getModerationDetail("VIDEO", videoId);
}

/**
 * The status change is not visible the moment this returns. admin-service writes an outbox row,
 * the dispatcher publishes it, and video-service applies it from admin.moderation-events — so the
 * revalidated page can still show the old status for a beat. Saying so beats a spinner that lies.
 */
export async function moderateVideoAction(
  videoId: string,
  /**
   * "approve" is a restore on the wire and "reject" a takedown — see `videoDecisions` — each with
   * its own confirmation.
   */
  action: "takedown" | "restore" | "approve" | "reject" | "purge",
  reason: string,
): Promise<ModerationResult> {
  if (!reason.trim()) {
    return { ok: false, message: "A reason is required — it goes into the audit log." };
  }

  try {
    const wire = action === "approve" ? "restore" : action === "reject" ? "takedown" : action;
    await moderateVideo(videoId, wire, reason.trim());
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }

  revalidatePath("/videos");
  revalidatePath("/trash");
  return {
    ok: true,
    message: {
      takedown: "Takedown recorded. The video leaves the feed once video-service consumes the event.",
      restore:
        "Restore recorded. The video returns to whatever state it was in before the takedown, not necessarily PUBLISHED.",
      approve: "Approval recorded. The video goes live once video-service consumes the event.",
      reject:
        "Rejection recorded. The video is taken down once video-service consumes the event, and never reaches the feed.",
      purge:
        "Permanent deletion recorded. The media is erased within seconds, once video-service and media-worker consume the event.",
    }[action],
  };
}

const BULK_VERBS = {
  approve: "Approved",
  reject: "Rejected",
  takedown: "Took down",
  restore: "Restored",
} as const;

/** One decision for every ticked row of the same kind, each written as its own audit entry. */
export async function bulkModerateVideosAction(
  videoIds: string[],
  action: keyof typeof BULK_VERBS,
  reason: string,
): Promise<ModerationResult> {
  const ids = plainIds(videoIds);
  if (!ids || !Object.hasOwn(BULK_VERBS, action)) {
    return { ok: false, message: "Nothing valid was selected." };
  }
  const why = cleanReason(reason);
  if (!why) {
    return { ok: false, message: "Give a reason of at most 1,000 characters — it goes into the audit log." };
  }

  const wire = action === "approve" ? "restore" : action === "reject" ? "takedown" : action;
  const outcome = await runEach(ids, (id) => moderateVideo(id, wire, why));

  revalidatePath("/videos");
  return {
    ok: outcome.failed.length === 0,
    message:
      bulkSummary(outcome, BULK_VERBS[action], "video")
      + (outcome.done > 0 ? " Each status changes once video-service consumes its event." : ""),
    failedIds: outcome.failed.map((failure) => failure.id),
  };
}
