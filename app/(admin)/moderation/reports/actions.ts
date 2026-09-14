"use server";

import { revalidatePath } from "next/cache";
import {
  getReportCount,
  getUserProfiles,
  getVideo,
  listComments,
  listTargetActions,
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

async function loadPreview(
  targetType: ReportTargetType,
  targetId: string,
): Promise<TargetPreview | null> {
  if (targetType === "USER") {
    const profile = (await getUserProfiles([targetId]))[targetId];
    if (!profile) return null;
    // A handle is how the user directory is searched, so an account without one (user-service
    // has not filled it in yet) gets the id back and no link rather than a link that finds
    // nothing.
    return {
      title: profile.username ? `@${profile.username}` : `#${targetId.slice(-8)}`,
      detail: `${profile.followerCount} followers`,
      href: profile.username ? `/users?q=${encodeURIComponent(profile.username)}` : null,
    };
  }

  if (targetType === "VIDEO") {
    const video = await getVideo(targetId);
    if (!video) return null;
    // Deleted first: a deleted video keeps whatever status it had, so showing PUBLISHED alone
    // would read as a video still up. The listing drops it, so there is nothing to link to.
    return {
      title: video.title,
      detail: video.deletedAt ? "deleted by its owner" : video.status,
      // Searched by title rather than id: the admin listing matches titles only, so this is the
      // only link that actually lands on the row.
      href: video.deletedAt ? null : `/videos?q=${encodeURIComponent(video.title)}`,
    };
  }

  const target = parseCommentTarget(targetId);
  if (!target) return null;
  const thread = await listComments(target.videoId, 200);
  const comment = thread.find((c) => c.commentId === target.commentId);
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
