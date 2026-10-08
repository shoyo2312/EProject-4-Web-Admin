import "server-only";

import { apiGet } from "./client";
import { USE_MOCK } from "./config";
import type { AdminUserResponse, AdminVideoResponse, UserProfileResponse } from "./types";
import { getAdminUser } from "./users";
import type { RowNames, VideoSummary } from "@/lib/names";
import { MOCK_REPORTER_HANDLES } from "@/lib/mock/moderation";
import { mockUsers } from "@/lib/mock/users";
import { mockVideos } from "@/lib/mock/videos";

/**
 * Handles (and avatar, follower count) for a batch of user ids, from user-service. Used to show a
 * video's owner as @handle rather than a bare id. Missing or blocked ids are simply absent from
 * the map — callers must tolerate a gap.
 */
export async function getUserProfiles(
  ids: string[],
): Promise<Record<string, UserProfileResponse>> {
  const unique = [...new Set(ids)].filter(Boolean);
  if (unique.length === 0) return {};
  if (USE_MOCK) {
    // The mock reporters are not in the mock directory, so their handles come from the ledger's
    // own fixture — the same handles the live path would get back for them.
    const handles = new Map<string, string>(Object.entries(MOCK_REPORTER_HANDLES));
    for (const user of mockUsers) handles.set(user.id, user.username);
    return Object.fromEntries(
      unique
        .filter((id) => handles.has(id))
        .map((id) => [
          id,
          {
            userId: id,
            username: handles.get(id) ?? null,
            displayName: null,
            avatarUrl: null,
            followerCount: 0,
            followingCount: 0,
          } satisfies UserProfileResponse,
        ]),
    );
  }
  const params = new URLSearchParams({ ids: unique.join(",") });
  const profiles = await apiGet<UserProfileResponse[]>(`/api/v1/users?${params}`);
  return Object.fromEntries(profiles.map((p) => [p.userId, p]));
}

/**
 * @handles for a batch of user ids — the admins on a page of the audit log, the reporters on a
 * page of the ledger, the accounts reports point at. One call for the page rather than one per
 * row. An id user-service does not know, or a user-service that cannot be reached, is simply
 * absent: the row keeps showing the id, which is what it showed before.
 */
export async function getHandles(ids: string[]): Promise<Record<string, string>> {
  const profiles = await getUserProfiles(ids).catch(
    (): Record<string, UserProfileResponse> => ({}),
  );
  const handles: Record<string, string> = {};
  for (const [id, profile] of Object.entries(profiles)) {
    if (profile.username) handles[id] = `@${profile.username}`;
  }
  return handles;
}

/**
 * Titles and poster frames for a batch of video ids, to name the rows of a list that otherwise
 * carry a bare id — the report queue, the audit log, the most-watched table.
 *
 * Best effort, by construction. The public batch route is the only one that takes a list of ids,
 * and it applies the viewer visibility rule: a video that is taken down, private, still
 * processing or deleted comes back absent, and its row keeps showing the id. The alternative —
 * the admin route, one call per row — would spend the gateway's per-address rate limit, which
 * every server-side call this console makes shares, on labels. A video's own page still reads it
 * through the admin route, with no rule applied.
 */
export async function getVideoSummaries(ids: string[]): Promise<Record<string, VideoSummary>> {
  const unique = [...new Set(ids)].filter(Boolean);
  if (unique.length === 0) return {};
  const summarise = (video: Pick<AdminVideoResponse, "title" | "thumbnailUrl" | "userId">) => ({
    title: video.title,
    thumbnailUrl: video.thumbnailUrl,
    userId: video.userId,
  });
  if (USE_MOCK) {
    return Object.fromEntries(
      mockVideos
        .filter((v) => unique.includes(v.id) && v.status === "PUBLISHED" && !v.deletedAt)
        .map((v) => [v.id, summarise(v)]),
    );
  }
  const params = new URLSearchParams({ ids: unique.join(",") });
  const videos = await apiGet<AdminVideoResponse[]>(`/api/v1/videos/batch?${params}`).catch(
    (): AdminVideoResponse[] => [],
  );
  return Object.fromEntries(videos.map((video) => [video.id, summarise(video)]));
}

/**
 * @handles for admins — the people the audit log and every moderation history name.
 *
 * From auth-service's directory, one call per admin, rather than {@link getHandles}' batch: the
 * bootstrap admin is created straight in auth-service and never gets a user-service profile, so
 * the batch cannot name the account that takes most of the actions. A page names a handful of
 * admins; the cap keeps a page of unknown ids from spending the gateway's rate limit.
 */
export async function getAdminHandles(adminIds: (string | null)[]): Promise<Record<string, string>> {
  const unique = [...new Set(adminIds)].filter((id): id is string => Boolean(id)).slice(0, 10);
  const accounts = await Promise.all(unique.map((id) => getAdminUser(id).catch(() => null)));
  return Object.fromEntries(
    accounts
      .filter((account): account is AdminUserResponse => account !== null)
      .map((account) => [account.id, `@${account.username}`]),
  );
}

/**
 * Everything one page of a moderation list needs to name its rows: accounts through
 * {@link getHandles}, admins through {@link getAdminHandles}, videos through
 * {@link getVideoSummaries}. Three lookups side by side, whatever the page size.
 */
export async function getRowNames(
  userIds: string[],
  videoIds: string[],
  adminIds: (string | null)[] = [],
): Promise<RowNames> {
  const [users, admins, videos] = await Promise.all([
    getHandles(userIds),
    getAdminHandles(adminIds),
    getVideoSummaries(videoIds),
  ]);
  return { handles: { ...users, ...admins }, videos };
}
