"use server";

import { getStrikeCount, listTargetActions } from "@/lib/api/moderation";
import { getAdminHandles, getUserProfiles } from "@/lib/api/names";
import { getReportCount } from "@/lib/api/reports";
import { getAdminUser } from "@/lib/api/users";
import { getVideo, listVideos } from "@/lib/api/videos";
import type {
  AdminVideoResponse,
  ModerationActionResponse,
  UserStatus,
  VideoStatus,
} from "@/lib/api/types";

/**
 * The uploader's track record, as far as each service answered. Null is "could not be read" and is
 * drawn as a dash — never as zero, which on a ban count would read as a clean record.
 */
export interface UploaderRecord {
  handle: string | null;
  status: UserStatus | null;
  joinedAt: string | null;
  followers: number | null;
  /**
   * Bans on the account, lifted ones included — admin-service's strike count for a USER target,
   * where a ban is the only enforcing action. Takedowns are counted on the videos, below.
   */
  bans: number | null;
  reports: number | null;
  uploads: number | null;
  takenDown: number | null;
  autoRemoved: number | null;
}

export interface ReviewContext {
  /**
   * The video as it is now. The queue's copy goes stale on both counts that matter here: its signed
   * media URLs last fifteen minutes, and another moderator may have decided it since. Null when
   * video-service no longer has it.
   */
  video: AdminVideoResponse | null;
  uploader: UploaderRecord;
  /** Reports filed against this video. A held video is not public, so this is usually zero. */
  reportCount: number | null;
  /**
   * Earlier decisions on this video: a held video taken down and then restored is held again. Null
   * when admin-service could not be read — an empty list would say no one has decided it before.
   */
  history: ModerationActionResponse[] | null;
  /** adminId → @handle, for the admins in `history`. */
  handles: Record<string, string>;
}

/**
 * Everything the review screen shows beside the player, for the one video on screen — fetched as
 * the moderator reaches it rather than for the whole batch, since this is ten reads and the batch
 * is fifty videos. Only the video itself is fatal: the rest is context, and a part of it that
 * cannot be read shows as unknown.
 */
export async function reviewContextAction(
  videoId: string,
  ownerId: string,
): Promise<ReviewContext> {
  const orNull = <T>(promise: Promise<T>) => promise.catch(() => null);
  const uploadsIn = (status?: VideoStatus) =>
    orNull(
      listVideos({ ownerIds: [ownerId], status, size: 1 }).then((page) => page.totalElements),
    );

  const [
    video,
    account,
    profiles,
    bans,
    reports,
    uploads,
    takenDown,
    autoRemoved,
    reportCount,
    history,
  ] = await Promise.all([
    getVideo(videoId),
    orNull(getAdminUser(ownerId)),
    orNull(getUserProfiles([ownerId])),
    orNull(getStrikeCount("USER", ownerId)),
    orNull(getReportCount("USER", ownerId)),
    uploadsIn(),
    uploadsIn("TAKEN_DOWN"),
    uploadsIn("REJECTED"),
    orNull(getReportCount("VIDEO", videoId)),
    orNull(listTargetActions("VIDEO", videoId)),
  ]);
  const profile = profiles?.[ownerId];

  return {
    video,
    uploader: {
      handle: account?.username ?? profile?.username ?? null,
      status: account?.status ?? null,
      joinedAt: account?.createdAt ?? null,
      followers: profile?.followerCount ?? null,
      bans,
      reports,
      uploads,
      takenDown,
      autoRemoved,
    },
    reportCount,
    history,
    handles: history ? await getAdminHandles(history.map((action) => action.adminId)) : {},
  };
}
