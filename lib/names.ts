import type { ReportTargetType } from "@/lib/api/types";

/** Enough of a video to name it in a list row. */
export interface VideoSummary {
  title: string;
  thumbnailUrl: string | null;
  userId: string;
}

/**
 * What a page of a moderation list calls the people and things in it — @handles for accounts
 * (admins, reporters, reported users), titles for videos. Fetched once per page by the server
 * and handed to the table; anything missing keeps showing its id.
 */
export interface RowNames {
  handles: Record<string, string>;
  videos: Record<string, VideoSummary>;
}

export const NO_NAMES: RowNames = { handles: {}, videos: {} };

/**
 * The ids a page needs names for: every account it mentions, plus each reported target sorted
 * by kind. A comment is left out — it is named by its text, which lives with the video's thread
 * and is read when the row is opened.
 */
export function idsToName(
  targets: readonly { targetType: ReportTargetType; targetId: string }[],
  people: readonly (string | null)[] = [],
): { userIds: string[]; videoIds: string[] } {
  const users = new Set(people.filter((id): id is string => Boolean(id)));
  const videos = new Set<string>();
  for (const { targetType, targetId } of targets) {
    if (targetType === "USER") users.add(targetId);
    else if (targetType === "VIDEO") videos.add(targetId);
  }
  return { userIds: [...users], videoIds: [...videos] };
}

/** A reported target's name — a @handle or a video title — or null to fall back to its id. */
export function targetName(
  names: RowNames,
  targetType: ReportTargetType,
  targetId: string,
): string | null {
  if (targetType === "USER") return names.handles[targetId] ?? null;
  if (targetType === "VIDEO") return names.videos[targetId]?.title || null;
  return null;
}
