import "server-only";

import { ApiError, apiGet, apiPost } from "./client";
import { USE_MOCK } from "./config";
import { LIST_PAGE_SIZE, mockPage } from "./shared";
import type {
  AdminUserResponse,
  ModerationActionResponse,
  Page,
  SecurityEventResponse,
  UserStatus,
} from "./types";
import { mockSecurityEvents } from "@/lib/mock/security-events";
import { mockUsers } from "@/lib/mock/users";

/**
 * The directory is served by auth-service, under /api/v1/auth/** rather than /api/v1/admin/**:
 * that is the database holding status and role, and admin-service is not allowed to read it.
 * Filtering happens server-side so a banned-account search does not depend on how many rows
 * the page happened to fetch.
 */
export async function listUsers(options: {
  q?: string;
  status?: UserStatus;
  page?: number;
  size?: number;
} = {}): Promise<Page<AdminUserResponse>> {
  const { q, status, page = 0, size = LIST_PAGE_SIZE } = options;

  if (USE_MOCK) {
    const needle = q?.trim().toLowerCase();
    const filtered = mockUsers.filter((user) => {
      if (status && user.status !== status) return false;
      if (!needle) return true;
      return (
        user.username.toLowerCase().includes(needle) ||
        (user.email?.toLowerCase().includes(needle) ?? false)
      );
    });
    return mockPage(filtered, page, size);
  }

  const params = new URLSearchParams({ page: String(page), size: String(size) });
  if (q) params.set("q", q);
  if (status) params.set("status", status);

  return apiGet<Page<AdminUserResponse>>(`/api/v1/auth/admin/users?${params}`);
}

/**
 * One account by id — what a report resolves to, since a report carries the reported user's id
 * and nothing else.
 *
 * Null when nothing is registered at that id or the account was deleted (404), and for an id
 * that is not a number at all (400) — a hand-edited URL is "not found", not a failure.
 */
export async function getAdminUser(userId: string): Promise<AdminUserResponse | null> {
  if (USE_MOCK) return mockUsers.find((user) => user.id === userId) ?? null;
  try {
    return await apiGet<AdminUserResponse>(`/api/v1/auth/admin/users/${userId}`);
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) return null;
    throw error;
  }
}

/**
 * The accounts a search term names, as ids the video listing can filter on.
 *
 * Typing a handle into the video search and getting nothing back is the whole reason this
 * exists: video documents carry `userId` and no handle, so the match has to happen in
 * auth-service's directory first. Capped because this widens a search — a term like "gmail"
 * matches every account with it in their email, and a thousand-id query is not a search.
 *
 * Non-fatal: if the directory cannot be reached the video search still runs on titles.
 */
export async function resolveOwners(q: string, limit = 25): Promise<string[]> {
  const term = q.trim();
  if (!term) return [];
  const page = await listUsers({ q: term, size: limit }).catch(() => null);
  return page?.content.map((user) => user.id) ?? [];
}

/**
 * One account's security log — sign-ins, failed attempts, password resets, address changes, the
 * admin second factor. auth-service, like the directory above: that is the database that records
 * them, and admin-service is not allowed to read it.
 *
 * Newest first, and no filter parameter: the console merges this into one timeline and narrows
 * there, so a second filter here would be a second thing to keep in step with the first.
 */
export async function listSecurityEvents(
  userId: string,
  size = LIST_PAGE_SIZE,
): Promise<Page<SecurityEventResponse>> {
  if (USE_MOCK) return mockPage(mockSecurityEvents[userId] ?? [], 0, size);

  const params = new URLSearchParams({ page: "0", size: String(size) });
  return apiGet<Page<SecurityEventResponse>>(
    `/api/v1/auth/admin/users/${userId}/security-events?${params}`,
  );
}

/**
 * Ban, unban, warn and sign-out all go through admin-service, not auth-service, even though
 * auth-service is what ends up changing the account: the call writes a moderation_actions record
 * and an outbox event, and auth-service (or notification-service, for a warning) applies it from
 * the topic. Calling auth-service directly would act with nothing in the audit log.
 */
export async function moderateUser(
  userId: string,
  action: "ban" | "unban" | "warn" | "revokeSessions",
  reason: string,
  /** Days until the ban lapses, or null for one that does not. Ignored by everything but a ban. */
  banDays: number | null = null,
): Promise<ModerationActionResponse> {
  if (USE_MOCK) {
    throw new Error(
      "Account actions require the live backend (ADMIN_USE_MOCK=false) — each writes an audit row and a Kafka event.",
    );
  }
  const path = action === "revokeSessions" ? "revoke-sessions" : action;
  return apiPost<ModerationActionResponse>(
    `/api/v1/admin/users/${userId}/${path}`,
    { reason, banDays },
  );
}
