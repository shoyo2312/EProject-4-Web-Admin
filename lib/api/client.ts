import "server-only";

import { cookies } from "next/headers";
import { GATEWAY_URL, SESSION_COOKIE } from "./config";
import { parseWithLongIdsAsStrings } from "./json";
import type { ApiResponse } from "./types";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(
  path: string,
  init: RequestInit & { authenticated?: boolean } = {},
): Promise<T> {
  const { authenticated = true, ...rest } = init;

  const headers = new Headers(rest.headers);
  headers.set("Accept", "application/json");

  if (authenticated) {
    const token = (await cookies()).get(SESSION_COOKIE)?.value;
    if (!token) {
      throw new ApiError(401, "NO_SESSION", "Not signed in.");
    }
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${GATEWAY_URL}${path}`, {
    ...rest,
    headers,
    // Admin data is operational — always read through to the services.
    cache: "no-store",
  });

  const text = await response.text();
  const body = text
    ? parseWithLongIdsAsStrings<ApiResponse<T>>(text)
    : null;

  if (!response.ok || (body && !body.success)) {
    throw new ApiError(
      response.status,
      body?.code ?? "UNKNOWN",
      body?.message ?? `Request to ${path} failed with ${response.status}.`,
    );
  }

  return flattenPage(body?.data ?? null) as T;
}

/**
 * video-service and user-service run @EnableSpringDataWebSupport(VIA_DTO), so their Spring
 * pages come back as `{ content, page: { size, number, totalElements, totalPages } }` while
 * auth-service and admin-service still send the flat legacy shape. Levelling both to the flat
 * `Page<T>` here keeps every caller from having to know which service answered — otherwise
 * `page.totalElements` is undefined and every derived figure renders as NaN.
 */
function flattenPage(data: unknown): unknown {
  if (
    data && typeof data === "object"
    && Array.isArray((data as { content?: unknown }).content)
    && typeof (data as { page?: unknown }).page === "object"
  ) {
    const { page, ...rest } = data as { page: Record<string, unknown> };
    return { ...rest, ...page };
  }
  return data;
}

export function apiGet<T>(path: string) {
  return request<T>(path);
}

export function apiPost<T>(path: string, payload?: unknown) {
  return request<T>(path, {
    method: "POST",
    headers: payload ? { "Content-Type": "application/json" } : undefined,
    body: payload ? JSON.stringify(payload) : undefined,
  });
}

/** Login is the one call made without a session — there isn't one yet. */
export function apiPostAnonymous<T>(path: string, payload: unknown) {
  return request<T>(path, {
    authenticated: false,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}
