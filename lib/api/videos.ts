import "server-only";

import { ApiError, apiGet, apiPost } from "./client";
import { USE_MOCK } from "./config";
import { LIST_PAGE_SIZE, mockPage } from "./shared";
import type { AdminVideoResponse, ModerationActionResponse, Page, VideoStatus } from "./types";
import { VIDEO_STATUS_LABELS } from "@/lib/labels";
import { mockVideos } from "@/lib/mock/videos";

/**
 * Served by video-service under /api/v1/videos/admin, not by admin-service: that is the store
 * owning status and visibility, and no service may read another's database. Every other GET on
 * /api/v1/videos is public, so this one path is pinned to ROLE_ADMIN in video-service's
 * SecurityConfig — it lists every owner's uploads, including the ones moderation removed.
 *
 * Filtering is server-side for the same reason as the user directory: "show me everything taken
 * down" must not depend on how many rows this page happened to fetch.
 */
export async function listVideos(options: {
  q?: string;
  status?: VideoStatus;
  /**
   * Owners whose uploads match too, on top of whatever `q` matches by title. video-service
   * stores the owner's id and user-service owns their handle, so a search for a handle has to
   * be resolved to ids before it gets here — see `resolveOwners`.
   */
  ownerIds?: string[];
  /**
   * Undefined for no filter on it (both live and deleted rows match, the default); true for
   * deleted rows only; false for live rows only.
   */
  deleted?: boolean;
  /** Same three states, on whether the media is already erased. The trash is deleted && !purged. */
  purged?: boolean;
  /**
   * Unset is newest upload first. The trash reads soonest-to-expire first, and the review queue
   * oldest upload first — the one that has waited longest.
   */
  sort?: "deletedAt,asc" | "createdAt,asc";
  page?: number;
  size?: number;
} = {}): Promise<Page<AdminVideoResponse>> {
  const { q, status, ownerIds, deleted, purged, sort, page = 0, size = LIST_PAGE_SIZE } = options;

  if (USE_MOCK) {
    const matches = mockSearch(q, ownerIds);
    const filtered = mockVideos.filter((video) => {
      if (status && video.status !== status) return false;
      if (deleted != null && Boolean(video.deletedAt) !== deleted) return false;
      if (purged != null && Boolean(video.purgeEventPublishedAt) !== purged) return false;
      return matches(video);
    });
    if (sort === "deletedAt,asc") {
      filtered.sort((a, b) => (a.deletedAt ?? "").localeCompare(b.deletedAt ?? ""));
    } else if (sort === "createdAt,asc") {
      filtered.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    }
    return mockPage(filtered, page, size);
  }

  const params = new URLSearchParams({ page: String(page), size: String(size) });
  if (q) params.set("q", q);
  if (status) params.set("status", status);
  if (deleted != null) params.set("deleted", String(deleted));
  if (purged != null) params.set("purged", String(purged));
  if (sort) params.set("sort", sort);
  for (const ownerId of ownerIds ?? []) params.append("ownerId", ownerId);

  return apiGet<Page<AdminVideoResponse>>(`/api/v1/videos/admin?${params}`);
}

/** The mock fixtures' version of video-service's search: the title term or the owners, OR'd. */
function mockSearch(q: string | undefined, ownerIds: string[] | undefined) {
  const needle = q?.trim().toLowerCase();
  const owners = new Set(ownerIds);
  return (video: AdminVideoResponse) =>
    (!needle && owners.size === 0)
    || (!!needle && video.title.toLowerCase().includes(needle))
    || owners.has(video.userId);
}

/**
 * How many videos stand in each status for the listing's own search, every status present and
 * zero included. One request where the videos page used to send a one-row listing per status —
 * five calls on every render, against a gateway rate limit the console's admins share.
 */
export async function getVideoStatusCounts(
  options: { q?: string; ownerIds?: string[] } = {},
): Promise<Record<VideoStatus, number>> {
  const { q, ownerIds } = options;

  if (USE_MOCK) {
    const matches = mockSearch(q, ownerIds);
    const counts = Object.fromEntries(
      Object.keys(VIDEO_STATUS_LABELS).map((status) => [status, 0]),
    ) as Record<VideoStatus, number>;
    for (const video of mockVideos) {
      if (matches(video)) counts[video.status] += 1;
    }
    return counts;
  }

  const params = new URLSearchParams();
  if (q) params.set("q", q);
  for (const ownerId of ownerIds ?? []) params.append("ownerId", ownerId);
  return apiGet<Record<VideoStatus, number>>(`/api/v1/videos/admin/stats/by-status?${params}`);
}

/**
 * One video by id, for the reports queue: a report carries a bare video id and the admin listing
 * can only be searched by title, so there is no other way back to what was reported.
 *
 * The admin route rather than the public one, which applies the viewer visibility rule and so
 * hides exactly the videos moderation cares about — taken down, private, still processing, or
 * deleted by their owner after the report came in. A 404 here means the id resolves to nothing at
 * all; the caller shows the report without a preview rather than failing the row.
 */
export async function getVideo(videoId: string): Promise<AdminVideoResponse | null> {
  if (USE_MOCK) return mockVideos.find((video) => video.id === videoId) ?? null;
  try {
    // A reported video id is whatever the reporter sent: encoded, it cannot step out of this path.
    return await apiGet<AdminVideoResponse>(`/api/v1/videos/admin/${encodeURIComponent(videoId)}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

/**
 * Takedown and restore go through admin-service even though video-service is what changes the
 * document: the call writes a moderation_actions row plus an outbox event, and video-service
 * applies it from admin.moderation-events. Calling video-service directly would change the
 * status with nothing in the audit log to say who did it or why.
 */
export async function moderateVideo(
  videoId: string,
  action: "takedown" | "restore" | "purge",
  reason: string,
): Promise<ModerationActionResponse> {
  if (USE_MOCK) {
    throw new Error(
      "Takedown requires the live backend (ADMIN_USE_MOCK=false) — it writes an audit row and a Kafka event.",
    );
  }
  return apiPost<ModerationActionResponse>(
    `/api/v1/admin/videos/${videoId}/${action}`,
    { reason },
  );
}
