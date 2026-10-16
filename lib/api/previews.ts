import "server-only";

import { getComments } from "./comments";
import { getUserProfiles } from "./names";
import type { ReportTargetType } from "./types";
import { getVideo } from "./videos";
import { formatCompact, plural } from "@/lib/format";
import { parseCommentTarget, targetHref } from "@/lib/moderation";

/**
 * What a report or an audit row points at, in the shape a row can show in one line. Null when the
 * target cannot be read back — a taken-down video is invisible to the endpoint that serves
 * previews, and an id from a deleted row resolves to nothing. The row still renders: the report,
 * its reason and the moderation history are the record, and a missing preview must not hide them.
 */
export interface TargetPreview {
  /** Headline: a video title, a @handle, or the comment text. */
  title: string;
  /** Second line — status, follower count, "removed", whatever that type makes obvious. */
  detail: string | null;
  /** Where in the console this target can be opened, or null when nothing can reach it. */
  href: string | null;
}

export async function getTargetPreview(
  targetType: ReportTargetType,
  targetId: string,
): Promise<TargetPreview | null> {
  if (targetType === "USER") {
    const profile = (await getUserProfiles([targetId]))[targetId];
    if (!profile) return null;
    return {
      title: profile.username ? `@${profile.username}` : `#${targetId.slice(-8)}`,
      detail: `${formatCompact(profile.followerCount)} ${plural(profile.followerCount, "follower")}`,
      // The account's own page, by id. A search link lands on a result set instead — several
      // rows for a handle that is a common substring, and none at all for an account that has
      // no handle yet.
      href: targetHref("USER", targetId),
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
      href: targetHref("VIDEO", targetId),
    };
  }

  const target = parseCommentTarget(targetId);
  if (!target) return null;
  const [comment] = await getComments(target.videoId, [target.commentId]);
  return {
    title: comment?.content ?? "(comment not found in the thread)",
    detail: comment?.deletedAt ? "already removed" : null,
    href: targetHref("COMMENT", targetId),
  };
}
