"use server";

import { revalidatePath } from "next/cache";
import {
  getReportCount,
  getUserProfiles,
  getVideo,
  getComments,
  listTargetActions,
  resolveQueueRow,
  resolveReport,
} from "@/lib/api/admin";
import type {
  ModerationActionResponse,
  ModerationActionType,
  ReportTargetType,
} from "@/lib/api/types";

export interface ModerationResult {
  ok: boolean;
  message: string;
}

/**
 * What the report points at, in the shape the queue can show in one line. Null when the target
 * cannot be read back — a taken-down video is invisible to the endpoint that serves previews, and
 * an id from a deleted row resolves to nothing. The row still renders: the report, its reason and
 * the moderation history are the record, and a missing preview must not hide them.
 */
export interface TargetPreview {
  /** Headline: a video title, a @handle, or the comment text. */
  title: string;
  /** Second line — status, follower count, "removed", whatever that type makes obvious. */
  detail: string | null;
  /** Where in the console this target can be opened, or null when nothing can reach it. */
  href: string | null;
}

export interface ReportTargetDetail {
  reportCount: number;
  actions: ModerationActionResponse[];
  preview: TargetPreview | null;
}

/**
 * A COMMENT target is stored as "videoId:commentId" — admin-service's CommentTarget, and what the
 * client sends — because comments are partitioned by video and the comment id alone reaches
 * nothing. Returns null for any other shape rather than guessing a video.
 */
function parseCommentTarget(targetId: string): { videoId: string; commentId: string } | null {
  const [videoId, commentId, ...rest] = targetId.split(":");
  if (!videoId || !commentId || rest.length > 0) return null;
  return { videoId, commentId };
}

export async function loadPreview(
  targetType: ReportTargetType,
  targetId: string,
): Promise<TargetPreview | null> {
  if (targetType === "USER") {
    const profile = (await getUserProfiles([targetId]))[targetId];
    if (!profile) return null;
    return {
      title: profile.username ? `@${profile.username}` : `#${targetId.slice(-8)}`,
      detail: `${profile.followerCount} followers`,
      // The account's own page, by id. A search link lands on a result set instead — several
      // rows for a handle that is a common substring, and none at all for an account that has
      // no handle yet.
      href: `/users/${targetId}`,
    };
  }

  if (targetType === "VIDEO") {
    const video = await getVideo(targetId);
    if (!video) return null;
    // Deleted first: a deleted video keeps whatever status it had, so showing PUBLISHED alone
    // would read as a video still up.
    return {
      title: video.title,
      detail: video.deletedAt ? "deleted by its owner" : video.status,
      // By id, and always present: the video's own page reads back what the listing cannot —
      // a taken-down video, and one its owner deleted after the report came in.
      href: `/videos/${targetId}`,
    };
  }

  const target = parseCommentTarget(targetId);
  if (!target) return null;
  const [comment] = await getComments(target.videoId, [target.commentId]);
  return {
    title: comment?.content ?? "(comment not found in the thread)",
    detail: comment?.deletedAt ? "already removed" : null,
    href: `/comments?videoId=${encodeURIComponent(target.videoId)}`,
  };
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
  const [reportCount, actions, preview] = await Promise.all([
    getReportCount(targetType, targetId),
    listTargetActions(targetType, targetId),
    // A preview is a convenience; the report and its history are the point, so a target that
    // cannot be read does not fail the whole row.
    loadPreview(targetType, targetId).catch(() => null),
  ]);
  return { reportCount, actions, preview };
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
): Promise<ModerationResult> {
  if (!reason.trim()) {
    return { ok: false, message: "A reason is required — it goes into the audit log." };
  }

  try {
    await resolveQueueRow(targetType, targetId, actionType, reason.trim());
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
): Promise<ModerationResult> {
  if (!reason.trim()) {
    return { ok: false, message: "A reason is required — it goes into the audit log." };
  }

  try {
    await resolveReport(reportId, actionType, reason.trim());
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
